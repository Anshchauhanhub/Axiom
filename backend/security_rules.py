"""
Security validation rules for Exiom authentication:
- Disposable/temporary email blocking
- Common domain typo detection (e.g. gamil.com -> gmail.com)
- Blacklist of common, casual, and predictable passwords
"""

import re
from typing import Optional

DISPOSABLE_EMAIL_DOMAINS = {
    "10minutemail.com", "10minutemail.net", "guerrillamail.com", "guerrillamailblock.com",
    "sharklasers.com", "grr.la", "guerrillamail.info", "guerrillamail.biz",
    "mailinator.com", "mailinater.com", "tempmail.com", "temp-mail.org",
    "yopmail.com", "yopmail.fr", "yopmail.net", "dispostable.com",
    "throwawaymail.com", "fakeinbox.com", "trashmail.com", "trashmail.net",
    "getairmail.com", "maildrop.cc", "crazymailing.com", "nada.ltd",
    "tempail.com", "mohmal.com", "generator.email", "inboxkitten.com",
    "burnermail.io", "tempmailo.com", "mytemp.email", "getnada.com",
    "dropmail.me", "fakemailgenerator.com", "emailondeck.com", "spambog.com",
    "tmail.ws", "tempinbox.com", "trashmail.org", "zillamail.com"
}

COMMON_DOMAIN_TYPOS = {
    "gamil.com": "gmail.com",
    "gmai.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gamil.co": "gmail.com",
    "gmail.co": "gmail.com",
    "gmaill.co": "gmail.com",
    "gmaile.com": "gmail.com",
    "hotmial.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hotmial.co": "hotmail.com",
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "yaho.co.in": "yahoo.co.in",
    "yahooo.co.in": "yahoo.co.in",
    "outlok.com": "outlook.com",
    "outloo.com": "outlook.com",
    "iclud.com": "icloud.com",
    "icld.com": "icloud.com",
    "protomail.com": "protonmail.com",
    "protonmai.com": "protonmail.com"
}

COMMON_CASUAL_PASSWORDS = {
    "password123", "password1234", "password1", "password@123", "password#123",
    "welcome123", "welcome1234", "welcome@123", "welcome#123",
    "admin123", "admin1234", "admin@123", "administrator123",
    "testing123", "test1234", "tester123", "test@123",
    "qwerty123", "qwerty1234", "qwertyuiop123", "asdfgh123",
    "exiom123", "edxiom123", "axiom123", "exiom@123",
    "pass1234", "pass12345", "password01", "password007",
    "iloveyou123", "monkey123", "dragon123", "master123",
    "sunshine123", "princess123", "football123", "cricket123",
    "shadow123", "superman123", "batman123", "charlie123"
}

def validate_email_security(email: str) -> str:
    """Validates email format, domain integrity, typo safety, and disposable status."""
    clean = email.lower().strip()
    if "@" not in clean:
        raise ValueError("Invalid email format")

    parts = clean.split("@", 1)
    user_part, domain = parts[0], parts[1]

    if not domain or "." not in domain:
        raise ValueError("Email must have a valid domain (e.g. gmail.com)")

    # 1. Check for domain typos
    if domain in COMMON_DOMAIN_TYPOS:
        suggested = COMMON_DOMAIN_TYPOS[domain]
        raise ValueError(f"Domain typo detected: did you mean @{suggested}?")

    # 2. Check for disposable / burner email domains
    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise ValueError("Disposable / temporary email addresses are not allowed. Please use a valid personal or professional email.")

    # 3. Check for obvious dummy user prefixes
    if user_part in {"test", "testing", "temp", "dummy", "fake"}:
        raise ValueError("Casual/dummy email prefixes are not permitted for account registration.")

    return clean


def validate_password_security(password: str, email: Optional[str] = None) -> str:
    """Validates password strength, entropy, and checks against common casual lists."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if len(password) > 128:
        raise ValueError("Password must not exceed 128 characters")

    # Character class requirements
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain at least one number")

    # Common / casual password blacklist
    normalized = re.sub(r"[\s_!@#$%^&*()-+=]", "", password).lower()
    if password.lower() in COMMON_CASUAL_PASSWORDS or normalized in COMMON_CASUAL_PASSWORDS:
        raise ValueError("Password is too common or casual. Please choose a stronger, unique password.")

    # Sequential characters check (e.g. 12345, abcde)
    sequences = ["12345", "23456", "34567", "45678", "56789", "abcdef", "bcdefg", "qwerty"]
    if any(seq in password.lower() for seq in sequences):
        raise ValueError("Password contains trivial sequential characters. Please choose a more secure password.")

    # Disallow passwords that contain the user's username prefix if email is supplied
    if email and "@" in email:
        username = email.split("@")[0].lower()
        parts = re.split(r"[_\.\+\-]", username)
        tokens = [re.sub(r"[^a-z0-9]", "", p) for p in parts]
        tokens.append(re.sub(r"[^a-z0-9]", "", username))  # also check full joined form
        for token in tokens:
            if len(token) >= 4 and token in password.lower():
                raise ValueError("Password cannot contain your email username prefix.")

    return password
