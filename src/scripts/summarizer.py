import sys
import json
import io
from newspaper import Article
import nltk

# Force UTF-8 encoding for stdout on Windows
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

def summarize_article(url):
    try:
        article = Article(url)
        article.download()
        article.parse()
        article.nlp()
        
        # Use top_image for more reliable image extraction
        image_url = article.top_image if article.top_image else ""
        
        # newspaper3k summary is usually points-based if article is long enough
        raw_summary = article.summary if article.summary else ""
        if raw_summary:
            # Extract top 5 ranked sentences from newspaper3k's NLP output
            sentences = [s.strip() for s in raw_summary.split('\n') if s.strip()]
            top_5 = sentences[:5]
            summary = "\n".join([f"• {s}" for s in top_5])
        else:
            # Fallback for very short articles
            text_snippet = article.text.strip().replace('\n', ' ')
            summary = f"• {text_snippet[:400]}..." if text_snippet else ""
        
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
