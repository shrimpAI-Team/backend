#!/usr/bin/env python3
"""
shrimpAI - Kịch bản quét và xử lý ảnh trùng lặp & ảnh lỗi trong Dataset
Hỗ trợ:
- Quét ảnh trùng lặp tuyệt đối (MD5 Hash)
- Phát hiện rò rỉ dữ liệu (ảnh vừa ở train vừa ở val)
- Phát hiện gán nhãn sai (ảnh cùng xuất hiện ở 2 loài khác nhau)
- Phát hiện ảnh hỏng, không mở được (Corrupted)
- Tùy chọn --delete để tự động dọn dẹp giữ lại 1 file duy nhất
"""

import sys
import io
import os
import hashlib
import argparse
from pathlib import Path
from collections import defaultdict
from PIL import Image

# Đảm bảo UTF-8 trên Windows terminal
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def compute_md5(file_path: Path) -> str:
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def is_valid_image(file_path: Path) -> bool:
    try:
        with Image.open(file_path) as img:
            img.verify()
        return True
    except Exception:
        return False


def main():
    root_dir = Path(__file__).resolve().parent.parent
    default_dataset = root_dir / "datasets"

    parser = argparse.ArgumentParser(description="shrimpAI - Check Duplicate and Corrupted Images")
    parser.add_argument("--dir", type=str, default=str(default_dataset),
                        help="Thư mục dataset cần quét (mặc định: datasets/)")
    parser.add_argument("--delete", action="store_true",
                        help="Tự động xóa các ảnh trùng lặp và ảnh hỏng (giữ lại 1 bản gốc duy nhất)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Chỉ liệt kê mà không xóa file (mặc định)")
    args = parser.parse_args()

    dataset_path = Path(args.dir).resolve()
    if not dataset_path.exists():
        print(f"❌ Không tìm thấy thư mục: {dataset_path}")
        sys.exit(1)

    print("=" * 65)
    print("🔍 SHRIMP AI - CÔNG CỤ QUÉT ẢNH TRÙNG LẶP & LỖI TRONG DATASET")
    print("=" * 65)
    print(f"📁 Thư mục kiểm tra: {dataset_path}")
    print(f"⚙️  Chế độ: {'🗑️  TỰ ĐỘNG XÓA (DELETE)' if args.delete else '👀 CHỈ KIỂM TRA (DRY-RUN)'}")
    print("-" * 65)

    # Tìm tất cả file ảnh
    all_image_files = []
    for ext in VALID_EXTENSIONS:
        all_image_files.extend(dataset_path.rglob(f"*{ext}"))
        all_image_files.extend(dataset_path.rglob(f"*{ext.upper()}"))

    # Loại bỏ file trùng do hoa thường nếu có
    all_image_files = sorted(list(set(all_image_files)))
    total_files = len(all_image_files)

    print(f"📸 Tìm thấy tổng cộng: {total_files} file ảnh")
    if total_files == 0:
        print("Dataset trống!")
        return

    print("⏳ Đang quét và kiểm tra dữ liệu...")

    hash_map = defaultdict(list)
    corrupted_files = []

    for idx, fpath in enumerate(all_image_files, 1):
        if idx % 200 == 0 or idx == total_files:
            print(f"   Progress: {idx}/{total_files} ảnh ({idx * 100 // total_files}%)", end="\r")

        # Kiểm tra ảnh hỏng
        if not is_valid_image(fpath):
            corrupted_files.append(fpath)
            continue

        # Tính hash MD5
        try:
            file_hash = compute_md5(fpath)
            hash_map[file_hash].append(fpath)
        except Exception:
            corrupted_files.append(fpath)

    print("\n" + "-" * 65)

    # Thống kê trùng lặp
    duplicate_groups = [paths for paths in hash_map.values() if len(paths) > 1]
    total_duplicates = sum(len(paths) - 1 for paths in duplicate_groups)

    # Phân loại trùng lặp:
    same_class_dups = 0
    cross_split_dups = 0   # train vs val (data leakage)
    cross_species_dups = 0 # khác loài hoàn toàn

    deleted_count = 0

    if duplicate_groups:
        print(f"\n⚠️  PHÁT HIỆN {len(duplicate_groups)} NHÓM ẢNH BỊ TRÙNG (Tổng số ảnh thừa: {total_duplicates}):\n")

        for grp_idx, paths in enumerate(duplicate_groups, 1):
            original = paths[0]
            duplicates = paths[1:]

            rel_orig = original.relative_to(dataset_path)
            print(f" 🔹 Nhóm #{grp_idx} [{len(paths)} ảnh giống hệt nhau]:")
            print(f"    Gốc   : {rel_orig}")

            for dup in duplicates:
                rel_dup = dup.relative_to(dataset_path)

                # Phân tích loại trùng
                parts_orig = rel_orig.parts
                parts_dup = rel_dup.parts

                note = ""
                if len(parts_orig) >= 2 and len(parts_dup) >= 2:
                    split_orig, class_orig = parts_orig[0], parts_orig[1]
                    split_dup, class_dup = parts_dup[0], parts_dup[1]

                    if class_orig != class_dup:
                        note = " ❌ [XUNG ĐỘT LOÀI - Cần xóa!]"
                        cross_species_dups += 1
                    elif split_orig != split_dup:
                        note = " ⚠️ [TRÙNG TRAIN-VAL (Data Leakage)!]"
                        cross_split_dups += 1
                    else:
                        note = " 🔄 [Trùng trong cùng tập dữ liệu]"
                        same_class_dups += 1

                print(f"    Trùng : {rel_dup}{note}")

                if args.delete:
                    try:
                        dup.unlink()
                        deleted_count += 1
                        print(f"            -> 🗑️ Đã xóa: {dup.name}")
                    except Exception as e:
                        print(f"            -> ❌ Lỗi khi xóa {dup.name}: {e}")
            print()
    else:
        print("\n✨ Tuyệt vời! Không phát hiện ảnh nào bị trùng lặp.")

    # Thống kê ảnh hỏng
    if corrupted_files:
        print(f"\n💥 PHÁT HIỆN {len(corrupted_files)} ẢNH BỊ HỎNG / LỖI ĐỌC:")
        for cf in corrupted_files:
            rel_cf = cf.relative_to(dataset_path)
            print(f"    ❌ {rel_cf}")
            if args.delete:
                try:
                    cf.unlink()
                    deleted_count += 1
                    print(f"       -> 🗑️ Đã xóa file hỏng: {cf.name}")
                except Exception as e:
                    print(f"       -> ❌ Lỗi xóa: {e}")
    else:
        print("✨ Tất cả ảnh đều hợp lệ và đọc tốt (Không có ảnh hỏng).")

    print("=" * 65)
    print("📊 TỔNG KẾT:")
    print(f" • Tổng số ảnh đã quét    : {total_files}")
    print(f" • Số ảnh trùng lặp       : {total_duplicates}")
    print(f" • Số ảnh hỏng/lỗi        : {len(corrupted_files)}")
    if args.delete:
        print(f" • Tổng số file đã dọn dẹp: {deleted_count} file")
        print("🎉 Thư mục dataset đã được làm sạch và tối ưu!")
    else:
        if total_duplicates > 0 or corrupted_files:
            print("\n💡 Gợi ý: Chạy lệnh sau để tự động xóa các ảnh trùng & hỏng:")
            print("   python scripts/check_duplicates.py --delete")
    print("=" * 65)


if __name__ == "__main__":
    main()

