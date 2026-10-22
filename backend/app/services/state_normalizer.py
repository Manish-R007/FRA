"""Canonicalize Indian state names so multilingual spellings share one key."""
import unicodedata


# Canonical English names plus common Hindi, Kannada, and Odia spellings used
# in FRA documents. Keep this list intentionally explicit: unknown locations
# are preserved instead of being guessed.
_STATE_ALIASES = {
    "Andhra Pradesh": ["आंध्र प्रदेश", "ಆಂಧ್ರ ಪ್ರದೇಶ", "ଆନ୍ଧ୍ର ପ୍ରଦେଶ"],
    "Arunachal Pradesh": ["अरुणाचल प्रदेश", "ಅರುಣಾಚಲ ಪ್ರದೇಶ", "ଅରୁଣାଚଳ ପ୍ରଦେଶ"],
    "Assam": ["असम", "ಅಸ್ಸಾಂ", "ଆସାମ"],
    "Bihar": ["बिहार", "ಬಿಹಾರ", "ବିହାର"],
    "Chhattisgarh": ["छत्तीसगढ़", "ಛತ್ತೀಸ್‌ಗಢ", "ଛତ୍ତିଶଗଡ଼"],
    "Goa": ["गोवा", "ಗೋವಾ", "ଗୋଆ"],
    "Gujarat": ["गुजरात", "ગુજરાત", "ಗುಜರಾತ್", "ଗୁଜରାଟ"],
    "Haryana": ["हरियाणा", "ಹರಿಯಾಣ", "ହରିୟାଣା"],
    "Himachal Pradesh": ["हिमाचल प्रदेश", "ಹಿಮಾಚಲ ಪ್ರದೇಶ", "ହିମାଚଳ ପ୍ରଦେଶ"],
    "Jharkhand": ["झारखंड", "ಝಾರ್ಖಂಡ್", "ଝାଡ଼ଖଣ୍ଡ"],
    "Karnataka": ["कर्नाटक", "ಕರ್ನಾಟಕ", "କର୍ଣ୍ଣାଟକ"],
    "Kerala": ["केरल", "കേരളം", "ಕೇರಳ", "କେରଳ"],
    "Madhya Pradesh": ["मध्य प्रदेश", "ಮಧ್ಯ ಪ್ರದೇಶ", "ମଧ୍ୟ ପ୍ରଦେଶ"],
    "Maharashtra": ["महाराष्ट्र", "ಮಹಾರಾಷ್ಟ್ರ", "ମହାରାଷ୍ଟ୍ର"],
    "Manipur": ["मणिपुर", "ಮಣಿಪುರ", "ମଣିପୁର"],
    "Meghalaya": ["मेघालय", "ಮೇಘಾಲಯ", "ମେଘାଳୟ"],
    "Mizoram": ["मिजोरम", "ಮಿಜೋರಾಂ", "ମିଜୋରାମ"],
    "Nagaland": ["नागालैंड", "ನಾಗಾಲ್ಯಾಂಡ್", "ନାଗାଲାଣ୍ଡ"],
    "Odisha": ["ओडिशा", "उड़ीसा", "ಒಡಿಶಾ", "ଓଡ଼ିଶା"],
    "Punjab": ["पंजाब", "ਪੰਜਾਬ", "ಪಂಜಾಬ್", "ପଞ୍ଜାବ"],
    "Rajasthan": ["राजस्थान", "ರಾಜಸ್ಥಾನ", "ରାଜସ୍ଥାନ"],
    "Sikkim": ["सिक्किम", "ಸಿಕ್ಕಿಂ", "ସିକ୍କିମ"],
    "Tamil Nadu": ["तमिलनाडु", "தமிழ்நாடு", "ತಮಿಳುನಾಡು", "ତାମିଲନାଡୁ"],
    "Telangana": ["तेलंगाना", "తెలంగాణ", "ತೆಲಂಗಾಣ", "ତେଲେଙ୍ଗାନା"],
    "Tripura": ["त्रिपुरा", "ತ್ರಿಪುರಾ", "ତ୍ରିପୁରା"],
    "Uttar Pradesh": ["उत्तर प्रदेश", "ಉತ್ತರ ಪ್ರದೇಶ", "ଉତ୍ତର ପ୍ରଦେଶ"],
    "Uttarakhand": ["उत्तराखंड", "ಉತ್ತರಾಖಂಡ", "ଉତ୍ତରାଖଣ୍ଡ"],
    "West Bengal": ["पश्चिम बंगाल", "ಪಶ್ಚಿಮ ಬಂಗಾಳ", "ପଶ୍ଚିମ ବଙ୍ଗ"],
    "Andaman and Nicobar Islands": ["अंडमान और निकोबार द्वीपसमूह", "ಅಂಡಮಾನ್ ಮತ್ತು ನಿಕೋಬಾರ್ ದ್ವೀಪಗಳು", "ଆଣ୍ଡାମାନ ଓ ନିକୋବର ଦ୍ୱୀପପୁଞ୍ଜ"],
    "Chandigarh": ["चंडीगढ़", "ಚಂಡೀಗಢ", "ଚଣ୍ଡୀଗଡ଼"],
    "Dadra and Nagar Haveli and Daman and Diu": ["दादरा और नगर हवेली और दमन और दीव", "ದಾದ್ರಾ ಮತ್ತು ನಗರ ಹವೇಲಿ ಮತ್ತು ದಮನ್ ಮತ್ತು ದಿಯು", "ଦାଦ୍ରା ଓ ନଗର ହାଭେଳି ଏବଂ ଦମନ ଓ ଦିଉ"],
    "Delhi": ["दिल्ली", "दिल्ली राष्ट्रीय राजधानी क्षेत्र", "ದೆಹಲಿ", "ଦିଲ୍ଲୀ"],
    "Jammu and Kashmir": ["जम्मू और कश्मीर", "ಜಮ್ಮು ಮತ್ತು ಕಾಶ್ಮೀರ", "ଜମ୍ମୁ ଓ କାଶ୍ମୀର"],
    "Ladakh": ["लद्दाख", "ಲಡಾಖ್", "ଲଦାଖ"],
    "Lakshadweep": ["लक्षद्वीप", "ಲಕ್ಷದ್ವೀಪ", "ଲକ୍ଷଦ୍ୱୀପ"],
    "Puducherry": ["पुदुच्चेरी", "पुडुचेरी", "ಪುದುಚೇರಿ", "ପୁଡୁଚେରୀ"],
}


def _key(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).casefold().strip()
    # Preserve Indic combining marks (category M); dropping them would make
    # many Kannada, Hindi, and Odia spellings fail to match their aliases.
    return "".join(char for char in value if unicodedata.category(char)[0] not in {"P", "S", "Z", "C"})


_CANONICAL_BY_KEY = {
    _key(alias): canonical
    for canonical, aliases in _STATE_ALIASES.items()
    for alias in [canonical, *aliases]
}
_CANONICAL_BY_KEY.update({
    _key("National"): "National",
    _key("Jammu & Kashmir"): "Jammu and Kashmir",
    _key("Andaman & Nicobar Islands"): "Andaman and Nicobar Islands",
    _key("Dadra and Nagar Haveli"): "Dadra and Nagar Haveli and Daman and Diu",
    _key("Daman and Diu"): "Dadra and Nagar Haveli and Daman and Diu",
})


def normalize_state_name(value: str | None) -> str | None:
    """Return canonical English state/UT name for known aliases."""
    if value is None or not value.strip():
        return value
    normalized = unicodedata.normalize("NFKC", value).strip()
    return _CANONICAL_BY_KEY.get(_key(normalized), normalized)
