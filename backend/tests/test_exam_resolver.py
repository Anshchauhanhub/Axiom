import pytest
from services.exam_resolver import resolve_exam

def test_resolve_exam_exact_matches():
    # Exact substring matches
    res1 = resolve_exam("i want to study gate da")
    assert res1.matched is True
    assert "GATE Data Science" in res1.entity.canonical_name

    res2 = resolve_exam("how to crack gate cs exam")
    assert res2.matched is True
    assert "GATE Computer Science" in res2.entity.canonical_name


def test_resolve_exam_fuzzy_matches():
    # Fuzzy match with typos
    res = resolve_exam("gate exm ds ai")
    assert res.matched is True
    assert "GATE Data Science" in res.entity.canonical_name


def test_resolve_exam_ambiguous():
    # Ambiguous - matching both CS and DA without clear differentiator
    res = resolve_exam("gate prep")
    assert res.matched is False
    assert len(res.candidates) > 0


def test_resolve_exam_generic():
    # Generic learning goals
    res = resolve_exam("learn python programming from scratch")
    assert res.matched is False
