import sys
import json
import io
import re
from newspaper import Article
from newspaper import nlp as np_nlp
import nltk

if __name__ == "__main__":
    # Force UTF-8 encoding for stdout on Windows (chi khi chay nhu script,
    # de file test import duoc ma khong boc lai stdout)
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Download NLTK data only if not present
def setup_nltk():
    try:
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('tokenizers/punkt_tab')
    except (LookupError, AttributeError):
        nltk.download('punkt', quiet=True)
        nltk.download('punkt_tab', quiet=True)

setup_nltk()

# Dau cau ket thuc doan; doan khong co dau nay (tieu de, chu thich anh...)
# se bi punkt noi lien voi doan sau.
TERMINAL = '.!?…:;"”\')»'
# Chu thich anh/video: "... - Ảnh: Công an cung cấp", "Ảnh: NGUYỄN KHÁNH"
CAPTION = re.compile(r'(?:^|[-–—(]\s*)(?:Ảnh|Video|Clip|Đồ họa)\s*:', re.IGNORECASE)
# Duoi ten bao trong <title>: "... - Báo VnExpress", "... | Tuổi Trẻ Online"
TITLE_SUFFIX = re.compile(r'\s+[-|–]\s+(?:Báo\s+)?(?:VnExpress|Tuổi Trẻ|CafeF|Vietstock)[^-|–]*$', re.IGNORECASE)


def _norm(s):
    return re.sub(r'\s+', ' ', s).strip().lower()


def prepare_text(title, text):
    """
    newspaper.nlp.split_sentences xoa '\\n' KHONG chen dau cach, nen doan khong
    co dau cau cuoi dinh lien doan sau ("...Ngoại ngữTrượt chuyên Anh",
    "Ảnh: NGUYỄN KHÁNHNhận lời mời"). O day:
      - bo doan trung tieu de va doan chu thich anh (khong phai noi dung)
      - them '.' cho doan thieu dau cau cuoi -> punkt tach dung cau
      - noi doan bang ' \\n' -> sau khi '\\n' bi xoa van con dau cach
    """
    t = _norm(TITLE_SUFFIX.sub('', title or ''))
    paras = []
    for raw in (text or '').split('\n'):
        p = re.sub(r'\s+', ' ', raw).strip()
        if not p:
            continue
        if t and _norm(p) == t:
            continue
        if CAPTION.search(p) and len(p) < 300:
            continue
        if p[-1] not in TERMINAL:
            p += '.'
        paras.append(p)
    return ' \n'.join(paras)


def build_summary(title, text, max_sents=5):
    """Chuoi gach dau dong '• ...' tu toi da max_sents cau quan trong nhat."""
    prepared = prepare_text(title, text)
    if not prepared:
        return ""
    sentences = np_nlp.summarize(title=title or '', text=prepared, max_sents=max_sents) if title else []
    sentences = [re.sub(r'\s+', ' ', s).strip() for s in sentences]
    sentences = [s for s in sentences if s]
    if sentences:
        return "\n".join(f"• {s}" for s in sentences)
    # Bai qua ngan / khong co tieu de: lay doan dau
    snippet = re.sub(r'\s+', ' ', prepared).strip()
    return f"• {snippet[:400]}..." if len(snippet) > 400 else f"• {snippet}"


def summarize_article(url):
    try:
        article = Article(url)
        article.download()
        article.parse()
        # nlp() nap stopwords/keywords ma nlp.summarize can dung
        article.nlp()

        # Use top_image for more reliable image extraction
        image_url = article.top_image if article.top_image else ""

        summary = build_summary(article.title, article.text)
        
        return {
            "success": True,
            "title": article.title,
            "summary": summary,
            "image": image_url,
            "text": article.text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No URL provided"}))
        sys.exit(1)
        
    url = sys.argv[1]
    result = summarize_article(url)
    print(json.dumps(result, ensure_ascii=False))
