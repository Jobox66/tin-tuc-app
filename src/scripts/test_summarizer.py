"""Chay: .venv/Scripts/python.exe -m unittest src/scripts/test_summarizer.py"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from summarizer import prepare_text, build_summary  # noqa: E402

TITLE = 'Nữ sinh từng trượt chuyên Anh thành thủ khoa trường Ngoại ngữ'
# Dung nguyen van dau bai VnExpress 5140699 (newspaper tra ve)
TEXT = (
    'Nữ sinh từng trượt chuyên Anh thành thủ khoa trường Ngoại ngữ\n\n'
    'Trượt chuyên Anh năm lớp 10, Thanh Thảo rẽ sang tiếng Trung, rồi trở thành thủ khoa đầu ra '
    'Đại học Ngoại ngữ, giành học bổng vào trường Sư phạm top 1 Trung Quốc.\n\n'
    'Lê Vũ Thanh Thảo, 22 tuổi, tốt nghiệp ngành Sư phạm tiếng Trung Quốc, trường Đại học Ngoại ngữ '
    '(ULIS), Đại học Quốc gia Hà Nội. Với điểm trung bình 3.92/4, Thảo là thủ khoa đầu ra của trường.\n\n'
    'Thảo trong lễ tốt nghiệp - Ảnh: Nhân vật cung cấp\n\n'
    'Cách đây chừng bốn tháng, nữ sinh quyết định học tiếp thạc sĩ tại Trung Quốc, ngành Sư phạm\n\n'
    'Trong năm cuối đại học, Thảo có hai tháng thực tập tại văn phòng Tân Hoa Xã tại Hà Nội.'
)


class PrepareText(unittest.TestCase):
    def test_bo_tieu_de_va_chu_thich_anh(self):
        out = prepare_text(TITLE + ' - Báo VnExpress', TEXT)
        self.assertFalse(out.startswith('Nữ sinh từng trượt'))
        self.assertNotIn('Ảnh:', out)

    def test_them_dau_cham_va_dau_cach_giua_doan(self):
        out = prepare_text(TITLE, TEXT)
        self.assertIn('ngành Sư phạm. \nTrong năm cuối', out)

    def test_rong(self):
        self.assertEqual(prepare_text('x', ''), '')


class BuildSummary(unittest.TestCase):
    def test_khong_con_chu_dinh(self):
        s = build_summary(TITLE, TEXT)
        self.assertTrue(s.startswith('• '))
        self.assertNotIn('Ngoại ngữTrượt', s)
        self.assertNotIn('Sư phạmTrong', s)
        self.assertNotIn('Ảnh:', s)
        # Moi dong la mot cau, khong co '\n' sot ben trong
        for line in s.split('\n'):
            self.assertTrue(line.startswith('• '), line)

    def test_ten_viet_tat_cuoi_doan_van_co_dau_cach(self):
        text = ('Trung thừa nhận đã thực hiện vụ giật 278 tờ vé số của ông D.\n\n'
                'Sau khi gây án, Trung chạy về khu vực phường Thuận Giao để bán vé số.')
        s = build_summary('Giật xấp vé số của người khuyết tật', text)
        self.assertNotIn('D.Sau', s)

    def test_bai_ngan_khong_tieu_de(self):
        self.assertEqual(build_summary('', 'Một câu ngắn'), '• Một câu ngắn.')


if __name__ == '__main__':
    unittest.main()
