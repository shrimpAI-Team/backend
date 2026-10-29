#!/usr/bin/env python3
"""
shrimpAI - Kịch bản tự động cào và thu thập dữ liệu ảnh giống tôm
Nguồn dữ liệu:
1. iNaturalist Open Data (Kho ảnh sinh học chính xác nhất thế giới)
2. Wikimedia Commons (Kho tư liệu đa phương tiện mở)

Tự động:
- Lọc ảnh lỗi, ảnh quá nhỏ
- Khử ảnh trùng lặp (MD5 hash)
- Tự động chia 80% train, 20% val vào thư mục datasets/
"""

import os
import sys
import io

# Đảm bảo in tiếng Việt & emoji không bị lỗi trên Windows terminal (cp1252)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import hashlib
import argparse
from pathlib import Path
from io import BytesIO
import requests
from PIL import Image

# Danh sách giống tôm cài đặt sẵn kèm tên khoa học & từ khóa
SHRIMP_SPECIES = {
    "the_chan_trang": {
        "name_vi": "Tôm thẻ chân trắng",
        "scientific_names": ["Litopenaeus vannamei", "Penaeus vannamei"],
        "wiki_keywords": ["Litopenaeus vannamei", "Whiteleg shrimp"]
    },
    "tom_su": {
        "name_vi": "Tôm sú",
        "scientific_names": ["Penaeus monodon"],
        "wiki_keywords": ["Penaeus monodon", "Giant tiger prawn", "Black tiger shrimp"]
    },
    "tom_cang_xanh": {
        "name_vi": "Tôm càng xanh",
        "scientific_names": ["Macrobrachium rosenbergii"],
        "wiki_keywords": ["Macrobrachium rosenbergii", "Giant freshwater prawn"]
    },
    "tom_hum": {
        "name_vi": "Tôm hùm",
        "scientific_names": ["Panulirus ornatus", "Panulirus homarus", "Panulirus argus"],
        "wiki_keywords": ["Panulirus ornatus", "Spiny lobster"]
    },
    "tom_tit": {
        "name_vi": "Tôm tít (Bề bề)",
        "scientific_names": ["Odontodactylus scyllarus", "Squilla empusa", "Gonodactylus smithii"],
        "wiki_keywords": ["Mantis shrimp", "Odontodactylus scyllarus"]
    },
    "tom_dat": {
        "name_vi": "Tôm đất",
        "scientific_names": ["Metapenaeus ensis", "Metapenaeus monoceros"],
        "wiki_keywords": ["Metapenaeus ensis", "Greasyback shrimp"]
    },
    "tom_hum_dat": {
        "name_vi": "Tôm hùm đất (Crawfish)",
        "scientific_names": ["Procambarus clarkii", "Cherax quadricarinatus"],
        "wiki_keywords": ["Procambarus clarkii", "Red swamp crayfish"]
    },
    "tep_kieng": {
        "name_vi": "Tép cảnh (Cherry Shrimp)",
        "scientific_names": ["Neocaridina davidi"],
        "wiki_keywords": ["Neocaridina davidi", "Cherry shrimp"]
    }
}

HEADERS = {
    "User-Agent": "shrimpAI-Crawler/1.0 (Aquaculture AI Vision Research)"
}


def get_inaturalist_image_urls(taxon_name: str, max_count: int = 200) -> list:
    """Thu thập danh sách URL ảnh từ iNaturalist API"""
    urls = []
    page = 1
    per_page = min(max_count, 100)

    while len(urls) < max_count:
        try:
            api_url = "https://api.inaturalist.org/v1/observations"
            params = {
                "taxon_name": taxon_name,
                "photos": "true",
                "quality_grade": "research,needs_id",
                "per_page": per_page,
                "page": page
            }
            res = requests.get(api_url, params=params, headers=HEADERS, timeout=12)
            if res.status_code != 200:
                break
            data = res.json()
            results = data.get("results", [])
            if not results:
                break

            for obs in results:
                for p in obs.get("photos", []):
                    raw_url = p.get("url")
                    if raw_url:
                        # Chuyển đổi sang ảnh cỡ medium/large chất lượng tốt
                        img_url = raw_url.replace("square.jpg", "medium.jpg").replace("square.jpeg", "medium.jpeg")
                        if img_url not in urls:
                            urls.append(img_url)
                    if len(urls) >= max_count:
                        break
                if len(urls) >= max_count:
                    break
            page += 1
        except Exception as e:
            print(f"  [iNat Warning] {taxon_name}: {e}")
            break
    return urls


def get_wikimedia_image_urls(keyword: str, max_count: int = 30) -> list:
    """Thu thập ảnh từ Wikimedia Commons API"""
    urls = []
    try:
        api_url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": keyword,
            "gsrnamespace": 6,  # File namespace
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "format": "json"
        }
        res = requests.get(api_url, params=params, headers=HEADERS, timeout=12)
        if res.status_code == 200:
            data = res.json()
            pages = data.get("query", {}).get("pages", {})
            for page_info in pages.values():
                image_info = page_info.get("imageinfo", [])
                if image_info:
                    info = image_info[0]
                    mime = info.get("mime", "")
                    if mime.startswith("image/jpeg") or mime.startswith("image/png"):
                        u = info.get("url")
                        if u and u not in urls:
                            urls.append(u)
                if len(urls) >= max_count:
                    break
    except Exception as e:
        print(f"  [Wiki Warning] {keyword}: {e}")
    return urls


def download_and_save_image(url: str, output_path: Path, seen_hashes: set, min_size: int = 150) -> bool:
    """Tải, kiểm tra tính hợp lệ, khử trùng lặp và lưu ảnh"""
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            return False

        # Kiểm tra trùng lặp bằng MD5 hash
        content_hash = hashlib.md5(res.content).hexdigest()
        if content_hash in seen_hashes:
            return False
        seen_hashes.add(content_hash)

        # Mở và xác thực ảnh bằng PIL
        img = Image.open(BytesIO(res.content))
        width, height = img.size
        if width < min_size or height < min_size:
            return False

        # Chuyển đổi định dạng RGB và lưu ảnh chuẩn JPG
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        elif img.mode != "RGB":
            img = img.convert("RGB")

        img.save(output_path, "JPEG", quality=92)
        return True
    except Exception:
        return False


def crawl_shrimp_species(species_key: str, train_dir: Path, val_dir: Path, target_count: int = 200, target_total: int = None):
    """Cào dữ liệu cho một giống tôm và phân bổ 80% train, 20% val"""
    if species_key not in SHRIMP_SPECIES:
        print(f"❌ Không tìm thấy giống tôm: {species_key}")
        return

    info = SHRIMP_SPECIES[species_key]
    print(f"\n🦐 [{info['name_vi']}] (key: {species_key})")

    species_train_dir = train_dir / species_key
    species_val_dir = val_dir / species_key
    species_train_dir.mkdir(parents=True, exist_ok=True)
    species_val_dir.mkdir(parents=True, exist_ok=True)

    # Đọc hash các ảnh hiện có trong thư mục để tránh trùng
    seen_hashes = set()
    for existing_file in list(species_train_dir.glob("*.jpg")) + list(species_val_dir.glob("*.jpg")):
        try:
            with open(existing_file, "rb") as f:
                seen_hashes.add(hashlib.md5(f.read()).hexdigest())
        except Exception:
            pass

    existing_count = len(list(species_train_dir.glob("*.jpg"))) + len(list(species_val_dir.glob("*.jpg")))
    print(f"   Đã có sẵn trong dataset: {existing_count} ảnh")

    if target_total is not None:
        needed = max(0, target_total - existing_count)
        if needed == 0:
            print(f"   ✨ Đã có đủ {existing_count}/{target_total} ảnh (đạt mục tiêu, bỏ qua).")
            return
        target_count = needed
        print(f"   🎯 Mục tiêu làm tròn: {target_total} ảnh -> Cần cào bù thêm {target_count} ảnh mới.")
    else:
        print(f"   🎯 Đang thu thập mục tiêu: cào thêm {target_count} ảnh mới...")

    # Thu thập URLs
    candidate_urls = []

    # 1. Từ iNaturalist
    for sci_name in info["scientific_names"]:
        urls = get_inaturalist_image_urls(sci_name, max_count=int(target_count * 1.5))
        candidate_urls.extend(urls)
        if len(candidate_urls) >= target_count * 2:
            break

    # 2. Từ Wikimedia
    for keyword in info["wiki_keywords"]:
        urls = get_wikimedia_image_urls(keyword, max_count=50)
        candidate_urls.extend(urls)

    # Bỏ URL trùng
    unique_urls = []
    for u in candidate_urls:
        if u not in unique_urls:
            unique_urls.append(u)

    print(f"   Tìm thấy {len(unique_urls)} URL tiềm năng từ nguồn mở...")

    saved_count = 0
    val_interval = 5  # Cứ 5 ảnh thì cho 1 ảnh vào val (~20% val, 80% train)

    for idx, url in enumerate(unique_urls):
        if saved_count >= target_count:
            break

        is_val = ((saved_count + 1) % val_interval == 0)
        target_folder = species_val_dir if is_val else species_train_dir
        filename = f"{species_key}_{existing_count + saved_count + 1:04d}.jpg"
        target_path = target_folder / filename

        success = download_and_save_image(url, target_path, seen_hashes)
        if success:
            saved_count += 1
            split_tag = "VAL " if is_val else "TRAIN"
            print(f"   [{split_tag}] ({saved_count}/{target_count}) Đã lưu: {filename}")

    total_now = len(list(species_train_dir.glob("*.jpg"))) + len(list(species_val_dir.glob("*.jpg")))
    print(f"✅ Hoàn thành [{info['name_vi']}]: Cào mới {saved_count} ảnh. Tổng hiện có: {total_now} ảnh.")


def main():
    root_dir = Path(__file__).resolve().parent.parent
    datasets_dir = root_dir / "datasets"
    train_dir = datasets_dir / "train"
    val_dir = datasets_dir / "val"

    parser = argparse.ArgumentParser(description="shrimpAI - Dataset Image Crawler")
    parser.add_argument("--species", type=str, default="all",
                        help=f"Giống tôm cần cào (hoặc 'all'). Danh sách: {', '.join(SHRIMP_SPECIES.keys())}")
    parser.add_argument("--count", type=int, default=200,
                        help="Số lượng ảnh cần cào mới cho mỗi giống (mặc định: 200)")
    parser.add_argument("--target-total", type=int, default=None,
                        help="Tự động cào bù cho đủ mốc tổng số ảnh (ví dụ: --target-total 200 nếu đã có 100 ảnh thì chỉ cào thêm 100 ảnh)")
    parser.add_argument("--list", action="store_true",
                        help="Hiển thị danh sách các giống tôm hỗ trợ")

    args = parser.parse_args()

    if args.list:
        print("\n📋 DANH SÁCH CÁC GIỐNG TÔM HỖ TRỢ SẴN TRONG SHRIMP AI:")
        print("=" * 65)
        for key, val in SHRIMP_SPECIES.items():
            print(f" • {key:<16} : {val['name_vi']:<25} ({val['scientific_names'][0]})")
        print("=" * 65)
        return

    print("=" * 65)
    print("🦐 SHRIMP AI - CÔNG CỤ TỰ ĐỘNG THU THẬP DỮ LIỆU GIỐNG TÔM")
    print("=" * 65)
    print(f"📁 Thư mục lưu trữ: {datasets_dir}")
    if args.target_total is not None:
        print(f"🎯 Chế độ làm tròn tổng số ảnh: Đạt {args.target_total} ảnh / giống")
    else:
        print(f"🎯 Số lượng cào thêm mỗi loài: {args.count} ảnh")

    if args.species == "all":
        selected_species = list(SHRIMP_SPECIES.keys())
    else:
        selected_species = [s.strip() for s in args.species.split(",") if s.strip() in SHRIMP_SPECIES]
        if not selected_species:
            print(f"❌ Không tìm thấy giống tôm hợp lệ nào từ: '{args.species}'")
            print(f"Các giống khả dụng: {', '.join(SHRIMP_SPECIES.keys())}")
            sys.exit(1)

    for sp in selected_species:
        crawl_shrimp_species(sp, train_dir, val_dir, target_count=args.count, target_total=args.target_total)

    print("\n" + "=" * 65)
    print("🎉 TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC CÀO VÀ SẮP XẾP SẴN SÀNG!")
    print("👉 Bây giờ bạn có thể huấn luyện lại mô hình bằng lệnh:")
    print("   python scripts/train.py --epochs 30 --batch 16")
    print("=" * 65)


if __name__ == "__main__":
    main()
