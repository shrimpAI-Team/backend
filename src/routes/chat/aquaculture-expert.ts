/**
 * Tri thức chuyên gia Thủy sản & Nuôi tôm cao cấp shrimpAI
 * Xử lý giải đáp thông minh, khoa học, thực tế theo chuẩn ngành Thủy sản Việt Nam.
 */

export interface MessageContext {
  role: string;
  content: string;
}

function normalizeVietnamese(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export class AquacultureExpert {
  /**
   * Sinh câu trả lời chuyên sâu về nuôi trồng thủy sản & tôm
   */
  public static generateResponse(query: string, history?: MessageContext[]): string {
    const raw = query || '';
    const q = raw.toLowerCase().trim();
    const qn = normalizeVietnamese(raw);

    // 1. Phân biệt các loài tôm
    if (
      q.includes('phân biệt') ||
      qn.includes('phan biet') ||
      q.includes('giống tôm') ||
      qn.includes('giong tom') ||
      q.includes('loại tôm') ||
      qn.includes('loai tom') ||
      q.includes('so sánh') ||
      qn.includes('so sanh') ||
      ((q.includes('tôm thẻ') || qn.includes('tom the')) && (q.includes('tôm sú') || qn.includes('tom su'))) ||
      q.includes('tôm càng xanh') ||
      qn.includes('tom cang xanh')
    ) {
      return `### 🦐 Hướng Dẫn Phân Biệt Các Giống Tôm Thương Phẩm Chủ Lực Tại Việt Nam

Để phân biệt chính xác giữa **Tôm thẻ chân trắng**, **Tôm sú** và **Tôm càng xanh**, người nuôi và kỹ thuật viên có thể dựa vào các tiêu chí hình thái và sinh học sau:

| Tiêu chí | Tôm Thẻ Chân Trắng (*L. vannamei*) | Tôm Sú (*P. monodon*) | Tôm Càng Xanh (*M. rosenbergii*) |
| :--- | :--- | :--- | :--- |
| **Màu sắc cơ thể** | Màu trắng sáng, trong suốt mờ, đôi khi xám nhạt | Thân có các dải vân sọc ngang đen - vàng hoặc đen - nâu đậm tương phản | Xanh lục nhạt, xám lục, thân có các vệt sọc dọc mờ |
| **Đặc điểm chân** | **Chân bò và chân bơi màu trắng sữa sáng rõ** | Chân bơi có sắc đỏ cam viền vàng hoặc sẫm màu | Chân ngực thứ 2 phát triển thành **đôi càng dài màu xanh dương** |
| **Vỏ tôm** | Vỏ rất mỏng, mềm dẻo, ôm sát cơ thể | Vỏ rất dày, cứng cáp, gồ ghề | Vỏ cứng trung bình, giáp đầu ngực to |
| **Răng cưa trên chủy** | 7 – 10 răng trên, 2 – 4 răng dưới | 7 – 8 răng trên, 3 – 4 răng dưới | 11 – 14 răng trên, 8 – 11 răng dưới |
| **Độ mặn thích hợp** | 5 – 35‰ (chịu rộng, nuôi được độ mặn thấp) | 15 – 25‰ (ưa nước lợ mặn vừa) | 0 – 12‰ (nước ngọt và nước lợ nhẹ) |
| **Mật độ nuôi phổ biến**| Thâm canh: 100 – 250 con/m² | Thâm canh: 25 – 45 con/m² | Bán thâm canh: 10 – 20 con/m² |
| **Thời gian nuôi** | 75 – 95 ngày (lớn nhanh, về size 30-40 con/kg)| 110 – 140 ngày (size lớn 15-25 con/kg) | 150 – 180 ngày |

#### 💡 Mẹo nhận diện nhanh ngoài thực tế:
- **Tôm thẻ:** Khi bốc lên tay, tôm búng liên tục, vỏ trong suốt nhìn thấy rõ chỉ ruột đen chạy dọc lưng và chân có màu trắng đục đặc trưng.
- **Tôm sú:** Nhìn thấy ngay các khoang vằn hổ (tiger pattern) đen sẫm trên vỏ lưng, đầu to và cầm đầm tay.
- **Tôm càng xanh:** Đôi càng kẹp dài gấp 1.5 – 2 lần chiều dài thân, có màu xanh ngọc bích nổi bật.`;
    }

    // 2. Chỉ số môi trường nước ao nuôi
    if (
      q.includes('chỉ số nước') ||
      qn.includes('chi so nuoc') ||
      q.includes('thông số nước') ||
      qn.includes('thong so nuoc') ||
      q.includes('độ kiềm') ||
      qn.includes('do kiem') ||
      q.includes('độ ph') ||
      qn.includes('do ph') ||
      qn.includes('oxy hoa tan') ||
      qn.includes('do man') ||
      qn.includes('moi truong nuoc') ||
      (q.includes('ph') && (q.includes('nước') || qn.includes('nuoc'))) ||
      q.includes('độ mặn') ||
      q.includes('oxy hòa tan') ||
      q.includes('môi trường nước')
    ) {
      return `### 🧪 Bảng Chỉ Số Môi Trường Nước Lý Tưởng Trong Ao Nuôi Tôm

Duy trì các chỉ số nước ổn định là yếu tố quyết định trên 70% tỷ lệ sống và tốc độ lớn của tôm nuôi:

| Chỉ số môi trường | Ngưỡng tối ưu | Tần suất đo | Cách điều chỉnh khi biến động |
| :--- | :--- | :--- | :--- |
| **Độ pH** | **7.5 – 8.5** (chênh lệch sáng - chiều $\\le$ 0.5) | 2 lần/ngày (6h & 14h) | pH thấp: bón vôi $CaCO_3$ hoặc Dolomite.<br/>pH cao: tạt mật rỉ đường + vi sinh lên men. |
| **Độ kiềm (Alkalinity)** | **120 – 160 mg/L** ($CaCO_3$) | 2 – 3 ngày/lần | Kiềm thấp: tạt $NaHCO_3$ (baking soda) 2-3kg/1000m³ vào ban đêm kèm vôi Dolomite. |
| **Oxy hòa tan (DO)** | **> 4.5 – 5.0 mg/L** (tuyệt đối không $< 3.5$) | Liên tục ban đêm & sáng sớm | Bật tối đa dàn quạt nước, sục khí đáy; cấp cứu bằng oxy viên ($Na_2CO_3 \\cdot 1.5H_2O_2$). |
| **Độ mặn** | 10 – 25‰ (thẻ: 5–30‰; sú: 15–25‰) | 1 tuần/lần | Cấp thêm nước ngọt hoặc nước ót mặn để điều chỉnh từ từ. |
| **Độ trong (Secchi)** | **30 – 40 cm** (nước màu xanh nõn chuối hoặc màu trà) | 1 ngày/lần | Nước quá trong: bón phân hữu cơ ủ EM.<br/>Nước quá đục: đánh vi sinh cắt tảo. |
| **Nhiệt độ nước** | **28 – 30°C** | 2 lần/ngày | Khi nhiệt độ $> 33°C$ hoặc $< 25°C$, giảm 30-50% lượng thức ăn. |
| **Khí độc $NH_3$** | **$< 0.1$ mg/L** (tự do) | 3 – 5 ngày/lần | Giảm ăn, tạt Yucca, nâng cao độ thoáng khí đáy ao. |
| **Khí độc $NO_2^-$** | **$< 0.2$ mg/L** | 3 – 5 ngày/lần | Bổ sung muối hột ($NaCl$), cấy vi sinh Nitrobacter liều cao. |
| **Khí độc $H_2S$** | **$< 0.03$ mg/L** (cực độc cho đáy) | Định kỳ kiểm tra bùn đáy | Rải zeolite, vôi nung $CaO$ hạ nguồn, cấy vi khuẩn quang dưỡng Rhodobacter. |

> 💡 **Khuyến nghị từ shrimpAI:** Hãy luôn đo thông số nước vào 2 thời điểm: **6:00 sáng** (thời điểm pH và DO thấp nhất trong ngày) và **14:00 chiều** (thời điểm pH và nhiệt độ cao nhất) để có bức tranh chính xác nhất.`;
    }

    // 3. Xử lý khí độc NH3, NO2, H2S
    if (
      q.includes('nh3') ||
      q.includes('no2') ||
      q.includes('h2s') ||
      q.includes('khí độc') ||
      qn.includes('khi doc') ||
      q.includes('xử lý khí') ||
      qn.includes('xu ly khi')
    ) {
      return `### 🌊 Phác Đồ Cấp Cứu Khi Ao Nuôi Tôm Bùng Phát Khí Độc $NH_3$ & $NO_2^-$

Khí độc là "kẻ sát thủ thầm lặng" làm tôm ngạt thở, mềm vỏ, giảm ăn và dễ nhiễm khuẩn gan tụy. Dưới đây là phác đồ can thiệp chuẩn:

#### 1. Xử lý khẩn cấp khí độc $NH_3$ (Ammonia tự do):
*Đặc tính: $NH_3$ càng nguy hiểm khi độ pH cao (> 8.2) và nhiệt độ nước nóng.*
- **Bước 1 - Cắt giảm thức ăn:** Lập tức giảm 40 – 50% khẩu phần ăn trong ngày để giảm lượng phân và đạm dư thừa.
- **Bước 2 - Hạ pH nhẹ:** Tạt mật rỉ đường lên men (3 – 5 kg/1000m³) hoặc acid hữu cơ sinh học để chuyển $NH_3$ độc thành ion amoni $NH_4^+$ không độc.
- **Bước 3 - Cấp cứu hấp thụ:** Tạt chiết xuất cây Yucca Schidigera (1 – 1.5 lít/1000m³) lúc 9 – 10h sáng để khóa phân tử ammonia tức thì.
- **Bước 4 - Tăng oxy hòa tan:** Bật toàn bộ quạt nước và sục khí đáy suốt ngày đêm để kích thích quá trình bay hơi và oxy hóa.

#### 2. Xử lý khí độc $NO_2^-$ (Nitrit):
*Đặc tính: $NO_2^-$ cạnh tranh liên kết với Hemocyanin trong máu tôm, làm máu mất khả năng vận chuyển oxy (hội chứng tôm xanh mắt / ngạt).*
- **Bước 1 - Đánh muối hột ($NaCl$):** Tạt muối ăn hạt to liều lượng **3 – 5 kg/1000m³**. Ion Clorua ($Cl^-$) sẽ cạnh tranh với ion $NO_2^-$ tại màng mang tôm, ngăn không cho nitrit thâm nhập vào máu tôm.
- **Bước 2 - Tăng quạt nước:** Đảm bảo hàm lượng oxy hòa tan luôn $> 5.0$ mg/L, vì vi khuẩn Nitrat hóa (*Nitrobacter*) cần rất nhiều oxy để oxy hóa $NO_2^-$ thành $NO_3^-$ (không độc).
- **Bước 3 - Cấy men vi sinh đặc hiệu:** Bổ sung các chủng vi khuẩn hiếu khí *Nitrosomonas* và *Nitrobacter* hoặc vi sinh cố định đạm chất lượng cao vào lúc 8 – 9h tối.
- **Bước 4 - Siphon đáy ao:** Hút sạch cặn bã hữu cơ và xác tảo chết tích tụ ở rốn ao vào đầu giờ sáng và sau các cữ ăn.

> ⚠️ **Lưu ý:** Tuyệt đối không dùng Chlorine hoặc các chất sát trùng mạnh trong lúc ao đang có khí độc cao, vì sẽ tiêu diệt hệ vi sinh có lợi và làm tình trạng độc tố trầm trọng hơn!`;
    }

    // 4. Bệnh đốm trắng (WSSV)
    if (
      q.includes('đốm trắng') ||
      qn.includes('dom trang') ||
      q.includes('wssv') ||
      q.includes('white spot')
    ) {
      return `### ⚠️ Chẩn Đoán & Phòng Trị Bệnh Đốm Trắng (WSSV) Trên Tôm

Bệnh đốm trắng do virus *White Spot Syndrome Virus* (WSSV) gây ra, là một trong những dịch bệnh nguy hiểm nhất với tỷ lệ chết có thể lên tới 80 – 100% chỉ trong 3 – 5 ngày.

#### 1. Dấu hiệu nhận biết điển hình:
- **Quan sát vỏ:** Xuất hiện các đốm trắng tròn đường kính **0.5 – 2 mm** ở mặt trong của giáp đầu ngực và đốt thân thứ 5, 6.
- **Hành vi tôm:** Tôm bơi lờ đờ, dạt mé bờ hoặc mặt nước, phản xạ búng rất yếu khi có tiếng động.
- **Màu sắc cơ thể:** Thân tôm chuyển màu hơi đỏ hồng, ruột rỗng hoàn toàn, gan tụy teo nhạt.

#### 2. Nguyên nhân và nguồn lây nhiễm:
- Lây truyền theo chiều dọc từ tôm bố mẹ không sạch bệnh.
- Lây theo chiều ngang qua nguồn nước cấp có giáp xác tự nhiên (cua, còng, cào cào biển mang virus WSSV) hoặc chim cò mang mầm bệnh.
- Sốc môi trường (nhiệt độ giảm đột ngột dưới 26°C hoặc mưa lớn làm giảm độ mặn và pH).

#### 3. Biện pháp xử lý & Cách phòng ngừa hiệu quả:
- **Do WSSV là virus nên hiện tại CHƯA CÓ THUỐC ĐẶC TRỊ.**
- **Nếu tôm đã đạt kích cỡ thu hoạch (size $\\ge$ 50 con/kg):** Tiến hành thu hoạch ngay lập tức để giảm thiểu thiệt hại kinh tế.
- **Nếu tôm còn nhỏ bị bùng phát:**
  1. Giữ nguyên nguồn nước trong ao, **tuyệt đối không xả ra kênh rạch tự nhiên** để tránh lây lan cho vùng nuôi xung quanh.
  2. Dập dịch an toàn bằng **Chlorine 30 – 50 ppm** (30 – 50 kg/1000m³) trong 7 – 10 ngày để tiêu hủy hoàn toàn mầm virus trước khi tháo bỏ.
- **Phòng bệnh an toàn sinh học (Biosecurity):**
  - Chỉ thả tôm giống Post-larvae (PL10-12) đã được xét nghiệm PCR âm tính với WSSV.
  - Lắp lưới chắn chim trên không và lưới chắn cua còng xung quanh bờ ao.
  - Xử lý nước cấp vào ao lắng bằng thuốc tím ($KMnO_4$) và Chlorine trước khi bơm vào ao nuôi.`;
    }

    // 5. Bệnh hoại tử gan tụy cấp (AHPND / EMS)
    if (
      q.includes('hoại tử gan tụy') ||
      qn.includes('hoai tu gan tuy') ||
      q.includes('gan tụy') ||
      qn.includes('gan tuy') ||
      q.includes('ahpnd') ||
      q.includes('ems') ||
      q.includes('teo gan') ||
      qn.includes('teo gan') ||
      q.includes('sưng gan') ||
      qn.includes('sung gan')
    ) {
      return `### ⚠️ Bệnh Hoại Tử Gan Tụy Cấp Tính (AHPND / EMS) Ở Tôm Nuôi

Hội chứng hoại tử gan tụy cấp tính do chủng vi khuẩn *Vibrio parahaemolyticus* mang plasmid độc tố gây bệnh (*PirA* và *PirB*), thường xảy ra trong **10 – 35 ngày đầu** sau khi thả giống.

#### 1. Triệu chứng lâm sàng:
- Khối gan tụy teo nhỏ lại, có màu nhợt nhạt, trắng xám hoặc đen chai cứng; dịch gan khô ráo khi bóp nát.
- Ruột tôm rỗng không có thức ăn, đứt khúc hoặc loãng màu.
- Tôm bơi lờ đờ, mềm vỏ, rớt đáy rải rác sau đó chết đồng loạt chỉ sau vài ngày.

#### 2. Phác đồ xử lý & phục hồi chức năng gan:
1. **Cắt giảm thức ăn:** Ngay lập tức giảm 50% lượng thức ăn trong 2 – 3 ngày để giảm gánh nặng cho hệ tiêu hóa.
2. **Xử lý nước:** Diệt khuẩn nhẹ bằng dung dịch **PVP-Iodine** (1.5 – 2 lít/1000m³) hoặc **Nano bạc** lúc trời mát để hạ mật độ vi khuẩn *Vibrio* trong nước mà không gây sốc tôm.
3. **Bổ sung thảo dược phục hồi gan:**
   - Trộn thảo dược chiết xuất từ **Diệp hạ châu**, **Actiso**, hoặc **dịch tỏi tươi** (15 – 20 ml/kg thức ăn).
   - Tăng cường Beta-glucan và Sorbitol nhằm giải độc gan và nâng cao đề kháng.
4. **Tái tạo hệ vi sinh đáy ao:** Sau 24 – 36h sát khuẩn, cấy lại dòng vi sinh *Bacillus subtilis* và *Bacillus licheniformis* liều gấp đôi để cạnh tranh sinh học với vi khuẩn có hại.`;
    }

    // 6. Bệnh phân trắng (White Feces Disease)
    if (
      q.includes('phân trắng') ||
      qn.includes('phan trang') ||
      q.includes('ruột tôm') ||
      qn.includes('ruot tom') ||
      q.includes('đứt khúc ruột') ||
      qn.includes('dut khuc ruot') ||
      q.includes('wfd')
    ) {
      return `### ⚠️ Cách Trị Bệnh Phân Trắng (White Feces Disease) Trên Tôm

Bệnh phân trắng thường xuất hiện ở giai đoạn tôm nuôi từ **40 – 70 ngày tuổi**, do sự cộng hưởng giữa vi khuẩn *Vibrio*, ký sinh trùng vi bào tử trùng (*EHP*) và thức ăn nhiễm nấm mốc hoặc tảo độc.

#### 1. Dấu hiệu nhận biết:
- Xuất hiện các đoạn phân màu trắng hoặc vàng nhạt nổi lềnh bềnh trên mặt nước, dạt về góc cuối hướng quạt nước.
- Quan sát đường ruột tôm: Ruột cong queo, đứt quãng hoặc rỗng, có dịch mủ trắng bên trong.
- Tôm giảm ăn rõ rệt từ 30 – 50%, tôm bị ốp thân, mềm vỏ, thịt mờ đục và chậm lớn.

#### 2. Phác đồ điều trị 4 bước chuẩn khoa học:
- **Bước 1 - Cắt ăn & dọn đáy:** Ngừng cho ăn 1 cữ hoàn toàn, các cữ sau giảm 50% khẩu phần. Siphon sạch đáy ao để loại bỏ mầm phân trắng tích tụ.
- **Bước 2 - Xử lý nguồn nước:** Đánh vi sinh xử lý nước và men tiêu hóa liều cao kèm mật rỉ đường để ức chế tảo lam/tảo giáp độc hại.
- **Bước 3 - Trộn thuốc điều trị đường ruột:**
  - **Kháng sinh sinh học / Thảo dược:** Dùng cao tỏi tươi ủ lên men (20ml/kg thức ăn) hoặc tinh dầu quế/oregano.
  - **Acid hữu cơ (Organic Acids):** Trộn acid formic / acid butyric (5 – 7g/kg) để hạ pH trong ruột tôm, tiêu diệt vi khuẩn có hại và bảo vệ niêm mạc ruột.
  - **Men vi sinh đường ruột:** Bổ sung chủng nấm men *Saccharomyces boulardii* và enzyme tiêu hóa (Protease, Amylase) giúp tái lập hệ vi sinh ruột.
- **Bước 4 - Phục hồi:** Cho ăn thức ăn giàu đạm dễ tiêu kết hợp khoáng chất vi lượng trong 5 – 7 ngày liên tục sau khi hết phân trắng.`;
    }

    // 7. Vi bào tử trùng EHP
    if (
      q.includes('ehp') ||
      q.includes('vi bào tử') ||
      qn.includes('vi bao tu') ||
      q.includes('chậm lớn') ||
      qn.includes('cham lon') ||
      q.includes('còi cọc') ||
      qn.includes('coi coc')
    ) {
      return `### 🔬 Bệnh Vi Bào Tử Trùng (*Enterocytozoon hepatopenaei* - EHP)

*EHP* là một loài ký sinh trùng nội bào lây nhiễm vào các tế bào biểu mô ống gan tụy của tôm, khiến tôm không thể hấp thu chất dinh dưỡng.

#### 1. Đặc điểm nhận biết:
- Tôm **không chết ồ ạt**, tôm vẫn ăn nhưng **cực kỳ chậm lớn**, kích cỡ đàn phân đàn mạnh (con to con bé lệch nhau rõ rệt).
- Hệ số tiêu tốn thức ăn (FCR) tăng vọt trên 1.6 – 2.0, gây tốn kém chi phí thức ăn lớn cho chủ ao.
- Gan tôm có thể mềm nhũn, nhạt màu và dễ nhiễm thêm bệnh phân trắng hoặc hoại tử gan tụy.

#### 2. Chiến lược phòng ngừa mấu chốt:
- **Hiện tại EHP không thể trị dứt điểm bằng thuốc sau khi đã xâm nhập sâu vào mô tôm.** Do đó phòng ngừa là yếu tố sống còn!
- **Cải tạo đáy ao:** Dùng vôi nung **$CaO$** rải đáy ao với liều 1 – 1.5 tấn/ha, cày xới kỹ để nâng pH đất lên **> 12**, giữ ẩm trong 5 – 7 ngày để làm nổ vỏ bào tử EHP.
- **Chọn giống:** 100% tôm giống phải qua kiểm định PCR sạch mầm bệnh EHP tại các trung tâm uy tín.
- **Nuôi ao lót bạt:** Hệ thống ao tròn lót bạt có hố siphon đáy giúp xả sạch phân tôm thường xuyên, giảm đến 90% nguy cơ lây truyền ngang.`;
    }

    // 8. Kỹ thuật cho ăn & Quản lý FCR
    if (
      q.includes('cho ăn') ||
      qn.includes('cho an') ||
      q.includes('thức ăn') ||
      qn.includes('thuc an') ||
      q.includes('fcr') ||
      q.includes('vó ăn') ||
      qn.includes('vo an') ||
      q.includes('nhá') ||
      qn.includes('nha') ||
      q.includes('khẩu phần ăn') ||
      qn.includes('khau phan an')
    ) {
      return `### 🍽️ Kỹ Thuật Quản Lý Thức Ăn & Tối Ưu Hệ Số FCR Cho Tôm Nuôi

Thức ăn chiếm từ 50 – 60% tổng chi phí của một vụ tôm. Quản lý thức ăn chuẩn xác giúp tôm lớn nhanh, nước ao sạch và giảm chi phí đầu tư:

#### 1. Khẩu phần ăn theo giai đoạn (Tôm thẻ chân trắng):
- **Giai đoạn 1 (Ngày 1 – 20):** 
  - Dùng thức ăn bột mịn độ đạm cao (40 – 42% protein).
  - Khẩu phần: 1.0 – 1.5 kg thức ăn / 100.000 con giống / ngày, chia làm 4 – 5 cữ/ngày.
- **Giai đoạn 2 (Ngày 21 – 50):** 
  - Dùng thức ăn viên mảnh nhỏ 1.0 – 1.5 mm (đạm 38 – 40%).
  - Lượng ăn: 4 – 6% tổng trọng lượng thân của đàn tôm. Bắt đầu đặt nhá (vó) để theo dõi.
- **Giai đoạn 3 (Ngày 51 – Thu hoạch):** 
  - Thức ăn cỡ 1.8 – 2.5 mm (đạm 36 – 38%).
  - Lượng ăn: 2.5 – 3.5% trọng lượng thân, chia làm 3 – 4 cữ/ngày.

#### 2. Kỹ thuật kiểm tra nhá (vó) chuẩn kỹ thuật:
- Đặt khoảng 2 – 3 nhá/1000m² ao nuôi ở các vị trí thoáng đáy, cách bờ 2 – 3m.
- Lấy khoảng 0.8 – 1.0% tổng lượng thức ăn của cữ đó đưa vào các nhá.
- **Thời gian canh nhá:**
  - Tôm 30 – 40 ngày: Kiểm tra sau **2 giờ**.
  - Tôm 41 – 60 ngày: Kiểm tra sau **1.5 giờ**.
  - Tôm > 60 ngày: Kiểm tra sau **1 giờ**.
- **Cách điều chỉnh:**
  - Nhá *hết sạch hoàn toàn*: Tăng 5% lượng thức ăn ở cữ tiếp theo.
  - Nhá *còn thừa 10%*: Giữ nguyên lượng ăn.
  - Nhá *còn thừa > 20%*: Giảm ngay 10 – 20% thức ăn cữ sau hoặc cắt hẳn 1 cữ nếu nước ao đang xấu.

> 💡 **Quy tắc vàng:** *"Thà cho tôm ăn thiếu một chút còn hơn cho ăn thừa một ít."* Thức ăn thừa sẽ phân hủy thành $NH_3$, $NO_2^-$ và làm hỏng cả vụ nuôi.`;
    }

    // 9. Quạt nước & sục khí oxy
    if (
      q.includes('quạt nước') ||
      qn.includes('quat nuoc') ||
      q.includes('sục khí') ||
      qn.includes('suc khi') ||
      q.includes('oxy đáy') ||
      qn.includes('oxy day') ||
      q.includes('dàn quạt') ||
      qn.includes('dan quat') ||
      q.includes('tính mã lực') ||
      qn.includes('ma luc')
    ) {
      return `### 💨 Kỹ Thuật Lắp Đặt Quạt Nước & Bố Trí Hệ Thống Sục Khí Đáy

Quạt nước đóng 3 vai trò sinh tử: Cung cấp oxy hòa tan, tạo dòng chảy gom chất thải vào rốn ao và giải phóng khí độc tầng đáy lên mặt nước.

#### 1. Công thức tính công suất quạt nước (Mã lực - HP):
- **Tôm thẻ nuôi thâm canh:** Cần **1 HP quạt nước cho 400 – 500 kg tôm thương phẩm dự kiến** trong ao.
- Ví dụ: Ao dự kiến thu 3 tấn tôm cần trang bị tối thiểu từ $6 - 8$ HP dàn quạt kết hợp hệ thống sục khí đáy nano-tube.

#### 2. Lịch vận hành quạt nước theo tuổi tôm:
- **Tôm 1 – 20 ngày:** Tôm còn nhỏ, chỉ cần quạt chạy với tốc độ vừa phải vào ban đêm (**23h00 – 05h00 sáng**) để duy trì oxy $> 4.5$ mg/L, tránh quạt quá mạnh làm tôm văng dạt bờ.
- **Tôm 21 – 50 ngày:** Chạy quạt từ **21h00 đêm đến 06h00 sáng** hôm sau, kèm thêm 1 tiếng vào buổi trưa (**12h00 – 13h00**) để tránh phân tầng nhiệt độ nước.
- **Tôm > 50 ngày tuổi đến thu hoạch:** Chạy quạt từ **18h00 tối đến 07h00 sáng**, và bật trong tất cả các cữ cho ăn để định hướng dòng chảy gom tụ phân.

#### 3. Bố trí góc nghiêng quạt nước:
- Cánh quạt nhúng sâu vào mặt nước từ **10 – 12 cm**. Nếu nhúng quá sâu sẽ gây quá tải động cơ và giảm hiệu suất tạo bọt khí; nếu nhúng quá nông sẽ không đủ lực khuấy đáy.`;
    }

    // 10. Ủ men vi sinh EM (EM tỏi, EM chuối)
    if (
      q.includes('ủ vi sinh') ||
      qn.includes('u vi sinh') ||
      q.includes('em tỏi') ||
      qn.includes('em toi') ||
      q.includes('em chuối') ||
      qn.includes('em chuoi') ||
      q.includes('nhân men') ||
      qn.includes('nhan men') ||
      q.includes('mật rỉ đường') ||
      qn.includes('mat ri duong') ||
      q.includes('chế phẩm sinh học') ||
      qn.includes('che pham sinh hoc')
    ) {
      return `### 🧄 Hướng Dẫn Ủ Men Vi Sinh EM Tỏi & EM2 Tiết Kiệm Chi Phí

Tự ủ men vi sinh thứ cấp tại trại giúp chủ ao tiết kiệm tới 70% chi phí thuốc men mà vẫn đảm bảo hiệu quả kháng khuẩn và xử lý môi trường:

#### 1. Công thức nhân sinh khối EM2 từ EM gốc (EM1):
- **Nguyên liệu chuẩn bị cho 100 lít dung dịch:**
  - 5 lít EM1 gốc
  - 5 kg mật rỉ đường nguyên chất (hoặc đường cát nâu)
  - 90 lít nước sạch (nước ngọt đã khử hết clo hoặc nước giếng khoan sạch)
- **Cách ủ:** Khuấy đều mật rỉ đường vào nước cho tan hết, cho EM1 vào thùng phuy đậy kín nắp, ủ yếm khí từ **5 – 7 ngày**. Khi mở ra thấy mùi thơm chua ngọt lên men và có lớp váng trắng nổi lên là đạt chuẩn.
- **Liều dùng:** 5 – 10 lít EM2 / 1000m³ ao nuôi, đánh định kỳ 3 – 5 ngày/lần vào lúc 9 – 10h sáng khi có nắng tốt.

#### 2. Công thức ủ EM Tỏi phòng trị bệnh phân trắng & đường ruột:
- **Nguyên liệu cho 20 lít dung dịch:**
  - 2 kg tỏi ta tươi (bóc vỏ, xay hoặc giã thật nhuyễn)
  - 2 lít EM2 (hoặc 1 lít EM1)
  - 1 kg mật rỉ đường
  - 15 lít nước ấm sạch (~35°C)
- **Cách ủ:** Trộn đều tất cả nguyên liệu trong can nhựa có nắp van xả khí, ủ trong **3 – 5 ngày**. Allicin trong tỏi kết hợp enzyme vi sinh sẽ tạo thành dung dịch kháng sinh tự nhiên cực mạnh.
- **Cách dùng:**
  - Trộn cho ăn phòng bệnh: 10 – 15 ml/kg thức ăn, cho ăn 2 cữ/ngày, liên tục trong tuần.
  - Tạt xử lý nước khi ao có mùi hôi hoặc tôm có dấu hiệu ruột yếu: 2 – 3 lít/1000m³.`;
    }

    // 11. Chuẩn bị ao nuôi & Cải tạo đáy
    if (
      q.includes('chuẩn bị ao') ||
      qn.includes('chuan bi ao') ||
      q.includes('cải tạo ao') ||
      qn.includes('cai tao ao') ||
      q.includes('lấy nước') ||
      qn.includes('lay nuoc') ||
      q.includes('bón vôi') ||
      qn.includes('bon voi') ||
      q.includes('gây màu nước') ||
      qn.includes('gay mau nuoc')
    ) {
      return `### 🚜 Quy Trình Cải Tạo Ao & Chuẩn Bị Nước Thả Tôm Chuẩn Kỹ Thuật

Cải tạo ao nuôi kỹ lưỡng giúp loại bỏ triệt để vi khuẩn, mầm bệnh đốm trắng, vi bào tử EHP và ấu trùng giáp xác trung gian trước khi thả giống:

#### 1. Bước 1 - Vệ sinh và phơi đáy ao:
- Tháo cạn nước, sên vét lớp bùn đen hữu cơ đáy ao ra khu vực chứa thải riêng biệt.
- Với ao lót bạt: Dùng máy xịt áp lực cao rửa sạch toàn bộ bạt bờ và bạt đáy, phơi nắng 3 – 5 ngày.
- Với ao đất: Cày xới đất sâu 10 – 15 cm và phơi khô nứt chân chim trong 10 – 14 ngày.

#### 2. Bước 2 - Bón vôi diệt khuẩn và khử phèn:
- Rải **Vôi nông nghiệp ($CaCO_3$)** liều 15 – 20 kg/100m² để tăng kiềm và đệm pH.
- Nếu ao có tiền sử bệnh EHP hoặc phèn nặng: Sử dụng **Vôi sống ($CaO$)** rải đều 10 – 15 kg/100m² khi đáy ao còn ẩm để tạo nhiệt và nâng pH đất $> 11$.

#### 3. Bước 3 - Lấy nước qua túi lọc mịn:
- Bơm nước từ sông vào ao lắng qua túi lọc bằng vải kate 2 lớp có mắt lưới $< 200$ micron để ngăn chặn trứng cá, tép tạp và cua còng.
- Giữ nước trong ao lắng 2 – 3 ngày cho lắng phù sa rồi xử lý diệt khuẩn bằng **Chlorine 25 – 30 ppm** (25 – 30 kg/1000m³) lúc chiều mát.

#### 4. Bước 4 - Gây màu nước trà (tảo khuê):
- Sau khi bơm nước đã xử lý vào ao nuôi từ 5 – 7 ngày (đã hết dư lượng Clo), tiến hành gây màu nước:
  - Dùng 10 lít men vi sinh EM2 + 2 kg mật đường + 1 kg cám gạo ủ qua đêm cho 1000m³.
  - Tạt vào lúc 8 – 9h sáng trời nắng to. Sau 2 – 3 ngày, nước ao sẽ lên màu trà óng ánh (tảo silic) rất đẹp, độ trong đạt 35 – 40 cm, có thể thả tôm an toàn.`;
    }

    // 12. Lựa chọn tôm giống Post-larvae (PL)
    if (
      q.includes('tôm giống') ||
      qn.includes('tom giong') ||
      q.includes('chọn giống') ||
      qn.includes('chon giong') ||
      q.includes('post larvae') ||
      q.includes('pl12') ||
      q.includes('sốc formol') ||
      qn.includes('soc formol')
    ) {
      return `### 🦐 Tiêu Chuẩn Vàng Khi Lựa Chọn Tôm Giống Post-Larvae (PL12)

Chất lượng con giống quyết định trên 50% thắng lợi của vụ mùa. Hãy áp dụng các bài kiểm tra thực nghiệm sau trước khi quyết định nhận tôm:

#### 1. Tiêu chí hình thái học:
- **Kích cỡ đồng đều:** Chiều dài tôm giống PL12 đạt từ **9 – 11 mm**, độ phân đàn không lệch quá 5%.
- **Quan sát dưới kính hiển vi:**
  - Gan tụy đầy đặn, có nhiều giọt lipid dự trữ (giọt dầu), sắc tố nâu sẫm.
  - Tỷ lệ cơ và ruột ở đốt bụng thứ 6 đạt chuẩn **4:1** (cơ thịt dày dặn, không teo rỗng).
  - Vỏ thân bóng loáng, sạch sẽ, không bám rong rêu hoặc nấm sợi.

#### 2. Thử nghiệm sức bền (Stress Test):
- **Thử sốc độ mặn:** Lấy 100 con tôm giống cho vào xô nước có độ mặn giảm đột ngột **50%** so với độ mặn trong bao vận chuyển. Theo dõi sau **2 giờ**, nếu tỷ lệ sống sót đạt **> 90%** là đạt chuẩn.
- **Thử sốc Formol:** Cho 100 con tôm giống vào dung dịch Formol nồng độ **100 ppm** (1 ml Formol trong 10 lít nước) trong **30 phút**, sau đó vớt tôm thả vào nước sạch 30 phút. Nếu tỷ lệ sống sót đạt **> 90%** chứng tỏ tôm rất khỏe, gan chắc và vỏ bóng.

#### 3. Kiểm định PCR sạch bệnh:
- Yêu cầu trại giống cung cấp phiếu xét nghiệm PCR mới nhất trong vòng 48 giờ đối với 5 loại bệnh nguy hiểm: **WSSV (Đốm trắng), AHPND/EMS (Hoại tử gan tụy), EHP (Vi bào tử), IHHNV (Còi xương), YHV (Đầu vàng)**.`;
    }

    // 13. Biofloc & Semi-Biofloc
    if (
      q.includes('biofloc') ||
      q.includes('semi-biofloc') ||
      q.includes('hạt floc') ||
      qn.includes('hat floc') ||
      q.includes('c:n')
    ) {
      return `### 🧬 Kỹ Thuật Nuôi Tôm Công Nghệ Biofloc & Semi-Biofloc

Công nghệ Biofloc là kỹ thuật nuôi hiện đại tận dụng vi sinh vật dị dưỡng để hấp thụ ammonia dư thừa và biến chúng thành các khối hạt vi sinh giàu đạm (**hạt floc**), làm nguồn thức ăn tự nhiên giàu dinh dưỡng cho tôm.

#### 1. Lợi ích vượt trội:
- Tiết kiệm 15 – 25% lượng thức ăn công nghiệp nhờ tôm ăn lại các hạt biofloc trong nước.
- Không cần thay nước thường xuyên, bảo vệ môi trường và hạn chế tối đa nguy cơ lây nhiễm mầm bệnh từ nguồn nước sông.
- Giữ nồng độ khí độc $NH_3$ và $NO_2^-$ luôn ở mức an toàn gần như bằng 0.

#### 2. Nguyên tắc cân bằng tỷ lệ C:N:
- Tỷ lệ Carbon : Nitơ tối ưu trong ao Biofloc là **12:1 đến 15:1**.
- Thức ăn công nghiệp thường giàu Nitơ nhưng thiếu Carbon. Do đó người nuôi cần định kỳ bổ sung nguồn Carbon hữu cơ như:
  - **Mật rỉ đường (Molasses)**: Giàu đường đơn, dễ tan.
  - **Bột mì lên men / Cám gạo**: Giúp hạt floc tạo bông xốp to hơn.
- **Cách tính lượng mật rỉ đường bổ sung:** Cứ mỗi 1 kg thức ăn công nghiệp (độ đạm ~38%) đưa vào ao, người nuôi cần bổ sung thêm **0.6 – 0.8 kg mật rỉ đường** đã được ủ hòa tan với vi sinh hiếu khí.

#### 3. Kiểm tra thể tích Floc:
- Dùng phễu thủy tinh Imhoff lấy 1000 ml nước ao nuôi, để lắng yên tĩnh trong 30 phút.
- Thể tích khối floc đạt từ **10 – 15 ml/L** là tối ưu cho tôm thẻ chân trắng.`;
    }

    // 14. Bệnh đục cơ, hoại tử cơ (IMNV) & Cong thân co cơ
    if (
      q.includes('đục cơ') ||
      qn.includes('duc co') ||
      q.includes('cong thân') ||
      qn.includes('cong than') ||
      q.includes('co cơ') ||
      qn.includes('co co') ||
      q.includes('imnv') ||
      q.includes('trắng lưng') ||
      qn.includes('trang lung')
    ) {
      return `### ⚠️ Hội Chứng Đục Cơ, Cong Thân Co Cơ Ở Tôm Nuôi

Hiện tượng tôm bị đục cơ và cong thân co cứng là vấn đề thường gặp vào mùa nắng nóng hoặc khi thời tiết thay đổi đột ngột:

#### 1. Nguyên nhân chính:
- **Thiếu hụt khoáng chất thiết yếu:** Đặc biệt là Magie ($Mg^{2+}$), Kali ($K^+$) và Canxi ($Ca^{2+}$), làm rối loạn áp suất thẩm thấu và co bóp cơ bắp.
- **Sốc nhiệt độ & môi trường:** Kéo vó (nhá) vào buổi trưa nắng gắt hoặc kiểm tra tôm khi quạt nước đang tắt, khiến tôm bị sốc nhiệt và giật cơ.
- **Bệnh do virus hoại tử cơ (IMNV):** Phần cơ thịt ở đốt đuôi trắng đục như cùi dừa, sau đó lan dần lên toàn thân và gây chết rải rác.

#### 2. Giải pháp can thiệp cấp tốc:
1. **Bổ sung khoáng tạt liều cao:** Tạt ngay hỗn hợp khoáng gồm:
   - **Kali Clorua ($KCl$):** 2 – 3 kg/1000m³.
   - **Magie Clorua ($MgCl_2$):** 3 – 5 kg/1000m³.
   - **Khoáng tạt tổng hợp:** 5 kg/1000m³.
2. **Chống sốc bằng Vitamin C:** Tạt Vitamin C chống sốc (2 – 3 kg/1000m³) trước khi chuyển đổi cữ quạt nước hoặc khi thời tiết chuyển biến mưa giông.
3. **Tuyệt đối không nhấc nhá giữa trưa nắng:** Toàn bộ công tác kiểm tra tôm, châm khoáng hoặc bắt mẫu chỉ thực hiện vào sáng sớm mát mẻ hoặc chiều tối.`;
    }

    // 15. Default Fallback - Trợ lý toàn diện
    return `### 🦐 Chào Bạn! Tôi Là Trợ Lý AI Chuyên Gia Thủy Sản & Kỹ Thuật Nuôi Tôm shrimpAI

Tôi sẵn sàng đồng hành cùng bà con nông dân, kỹ sư ao nuôi và các bạn sinh viên chuyên ngành Thủy sản để tư vấn các vấn đề chuyên sâu:

- 🦐 **Nhận diện & Sinh học giống tôm**: Phân biệt tôm thẻ chân trắng (*L. vannamei*), tôm sú (*P. monodon*), tôm càng xanh (*M. rosenbergii*), tôm hùm...
- 🧪 **Kiểm soát chất lượng nước ao nuôi**: Chuẩn độ pH, độ kiềm (Alkalinity), oxy hòa tan (DO), độ mặn, nhiệt độ và độ trong.
- 🌊 **Khử độc cấp cứu ao nuôi**: Xử lý triệt để khí độc $NH_3$, $NO_2^-$, $H_2S$, bùn đáy ao và phèn sắt.
- ⚠️ **Chẩn đoán & phác đồ dịch bệnh tôm**: Bệnh đốm trắng (WSSV), hoại tử gan tụy cấp (AHPND/EMS), phân trắng (WFD), vi bào tử trùng (EHP), đục cơ cong thân...
- 🍽️ **Kỹ thuật cho ăn & Quản lý FCR**: Canh vó (nhá), tính khẩu phần ăn, công thức ủ vi sinh EM tỏi, bổ sung khoáng chất kích lột xác.
- 🚜 **Cải tạo ao & Công nghệ nuôi hiện đại**: Ao lót bạt, công nghệ vi sinh Biofloc, Semi-Biofloc, nuôi tôm 2 – 3 giai đoạn năng suất cao.

---
> 💡 *Bạn hãy đặt câu hỏi chi tiết về tình trạng ao tôm, triệu chứng bất thường hoặc chỉ số nước cụ thể để tôi đưa ra phác đồ chính xác nhất!*`;
  }
}
