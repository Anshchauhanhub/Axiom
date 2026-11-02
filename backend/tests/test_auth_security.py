import pytest
from pydantic import ValidationError
from schemas import RegisterRequest, ResetPasswordRequest
from security_rules import validate_email_security, validate_password_security

def test_reject_typo_domain_gamil():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="anshtusharkapapa@gamil.com",
            password="StrongPassword123#!"
        )
    assert "did you mean @gmail.com" in str(exc.value).lower()

def test_reject_disposable_email():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="temporaryuser@10minutemail.com",
            password="StrongPassword123#!"
        )
    assert "disposable / temporary" in str(exc.value).lower()

def test_reject_casual_common_password_password123():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="legituser@gmail.com",
            password="Password123"
        )
    assert "too common or casual" in str(exc.value).lower()

def test_reject_casual_common_password_admin123():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="legituser@gmail.com",
            password="Admin123"
        )
    assert "too common or casual" in str(exc.value).lower()

def test_reject_sequential_characters():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="legituser@gmail.com",
            password="Abcdef123456!"
        )
    assert "trivial sequential characters" in str(exc.value).lower()

def test_reject_username_in_password():
    with pytest.raises(ValidationError) as exc:
        RegisterRequest(
            email="tushar_sharma@gmail.com",
            password="TusharRocks2026!"
        )
    assert "cannot contain your email username prefix" in str(exc.value).lower()

def test_valid_strong_credentials_pass():
    req = RegisterRequest(
        email="scholar@exiom.live",
        password="Vibrant#P@ssw0rd99",
        account_type="student"
    )
    assert req.email == "scholar@exiom.live"

def test_reset_password_enforces_security():
    with pytest.raises(ValidationError) as exc:
        ResetPasswordRequest(
            token="fake-token",
            new_password="Password123"
        )
    assert "too common or casual" in str(exc.value).lower()

    valid = ResetPasswordRequest(
        token="valid-token",
        new_password="Super#Secret2026!Key"
    )
    assert valid.new_password == "Super#Secret2026!Key"
