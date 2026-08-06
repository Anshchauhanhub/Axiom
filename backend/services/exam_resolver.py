import logging
from dataclasses import dataclass, field

logger = logging.getLogger("edxiom.exam_resolver")

# ---------------------------------------------------------------------------
# 1. REGISTRY OF KNOWN EXAMS
# ---------------------------------------------------------------------------

@dataclass
class ExamEntity:
    canonical_name: str
    aliases: list[str]
    official_domain: str
    key_topics: list[str] = field(default_factory=list)


EXAM_REGISTRY: list[ExamEntity] = [
    ExamEntity(
        canonical_name="GATE Data Science and Artificial Intelligence (GATE DA)",
        aliases=["gate da", "gate-da", "gateda", "gate daa", "gate data science", "da paper gate", "gate ai ds", "gate ai and ds"],
        official_domain="gate2026.iitg.ac.in",
        key_topics=["probability and statistics", "linear algebra", "calculus and optimization",
                     "programming and data structures", "database management",
                     "machine learning", "artificial intelligence"],
    ),
    ExamEntity(
        canonical_name="GATE Computer Science and Information Technology (GATE CS)",
        aliases=["gate cs", "gate-cs", "gate cse", "gate computer science", "gate it", "gate cs exam"],
        official_domain="gate2026.iitg.ac.in",
        key_topics=["algorithms", "operating systems", "dbms", "computer networks",
                     "theory of computation", "compiler design", "digital logic"],
    ),
    ExamEntity(
        canonical_name="GATE Mechanical Engineering (GATE ME)",
        aliases=["gate me", "gate mech", "gate mechanical"],
        official_domain="gate2026.iitg.ac.in",
        key_topics=["thermodynamics", "fluid mechanics", "strength of materials",
                     "manufacturing", "theory of machines"],
    ),
    ExamEntity(
        canonical_name="CAT Common Admission Test (CAT)",
        aliases=["cat", "cat exam", "cat dilr", "cat quant", "cat varc"],
        official_domain="iimcat.ac.in",
        key_topics=["quantitative aptitude", "data interpretation", "logical reasoning", "verbal ability", "reading comprehension"],
    ),
    ExamEntity(
        canonical_name="UPSC Civil Services Examination (UPSC CSE)",
        aliases=["upsc", "upsc cse", "ias exam", "ips exam", "civil services"],
        official_domain="upsc.gov.in",
        key_topics=["history", "geography", "polity", "economy", "environment", "general studies", "current affairs"],
    ),
    ExamEntity(
        canonical_name="AWS Solutions Architect Associate (SAA-C03)",
        aliases=["aws saa", "aws solutions architect", "saa-c03", "aws saa-c03", "aws solutins"],
        official_domain="aws.amazon.com",
        key_topics=["s3", "ec2", "iam", "vpc", "rds", "lambda", "route 53", "autoscaling"],
    ),
    ExamEntity(
        canonical_name="Python Data Structures & Algorithms (DSA)",
        aliases=["python dsa", "pythn dsa", "pithon dsa", "python data structures", "dsa in python"],
        official_domain="python.org",
        key_topics=["arrays and strings", "linked lists", "stacks and queues", "trees and graphs", "sorting and searching", "dynamic programming"],
    ),
    ExamEntity(
        canonical_name="Full Stack Web Development (React & Node.js)",
        aliases=["fullstack", "web development", "reactjs", "react js", "node js", "mern stack"],
        official_domain="react.dev",
        key_topics=["html css javascript", "react components & state", "node js & express", "rest apis", "mongodb & postgresql", "web deployment"],
    ),
    ExamEntity(
        canonical_name="Machine Learning & Artificial Intelligence Core",
        aliases=["machine learning", "machin lernin", "ai ml", "machine learning syllabus", "deep learning"],
        official_domain="scikit-learn.org",
        key_topics=["python for data science", "linear regression & classification", "decision trees & random forests", "neural networks & deep learning", "nlp & computer vision"],
    )
]

CONFIDENCE_THRESHOLD = 75.0


# ---------------------------------------------------------------------------
# 2. PURE PYTHON FUZZY MATCHING (With Lexical Filtering & Boosting)
# ---------------------------------------------------------------------------

STOP_WORDS = {"i", "want", "to", "study", "learn", "how", "prepare", "for", "the", "exam", "course", "from", "scratch", "a", "an", "and", "in", "on", "of", "with", "prep"}


def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def token_sort_ratio(s1: str, s2: str) -> float:
    s1_clean = "".join(c for c in s1.lower() if c.isalnum() or c.isspace())
    s2_clean = "".join(c for c in s2.lower() if c.isalnum() or c.isspace())
    
    tokens1 = sorted(s1_clean.split())
    tokens2 = sorted(s2_clean.split())
    
    sorted_s1 = " ".join(tokens1)
    sorted_s2 = " ".join(tokens2)
    
    lensum = len(sorted_s1) + len(sorted_s2)
    if lensum == 0:
        return 100.0
    
    ldist = levenshtein_distance(sorted_s1, sorted_s2)
    return ((lensum - ldist) / lensum) * 100.0


def extract_matches(query: str, choices: list[str], scorer, limit: int = 5) -> list[tuple[str, float]]:
    query_tokens = set(query.lower().split())
    query_keywords = {t for t in query_tokens if t not in STOP_WORDS}
    
    results = []
    for choice in choices:
        choice_tokens = set(choice.lower().split())
        choice_keywords = {t for t in choice_tokens if t not in STOP_WORDS}
        
        # Lexical validation: must share at least one keyword, or query must contain choice, or vice-versa
        if not (query_keywords & choice_keywords) and not (query in choice) and not (choice in query):
            score = 0.0
        else:
            score = scorer(query, choice)
        results.append((choice, score))
        
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:limit]


# ---------------------------------------------------------------------------
# 3. ENTITY RESOLUTION PIPELINE
# ---------------------------------------------------------------------------

@dataclass
class ResolutionResult:
    matched: bool
    entity: ExamEntity | None
    confidence: float
    candidates: list[tuple[str, float]]


def resolve_exam(raw_user_text: str) -> ResolutionResult:
    text = raw_user_text.lower().strip()

    # Build flat alias -> entity pool
    alias_pool: dict[str, ExamEntity] = {}
    for entity in EXAM_REGISTRY:
        for alias in entity.aliases:
            alias_pool[alias] = entity

    # Pass 1: exact whole-alias substring match
    exact_hits = {alias: alias_pool[alias] for alias in alias_pool if alias in text}
    exact_entities = {e.canonical_name: e for e in exact_hits.values()}
    if len(exact_entities) == 1:
        entity = next(iter(exact_entities.values()))
        logger.info(f"🎯 Exact substring match found for '{text}': {entity.canonical_name}")
        return ResolutionResult(matched=True, entity=entity, confidence=100.0, candidates=[])

    # Pass 2: fuzzy match using token sort ratio
    matches = extract_matches(
        text, list(alias_pool.keys()), scorer=token_sort_ratio, limit=5
    )

    # Filter out 0 score matches
    matches = [m for m in matches if m[1] > 0.0]

    if not matches:
        return ResolutionResult(matched=False, entity=None, confidence=0.0, candidates=[])

    # Pass 3: Keyword-based boosting for highly specific test code indicators
    boosts = {}
    tokens = set(text.split())
    if any(t in tokens for t in ["da", "ds", "ai"]):
        boosts["GATE Data Science and Artificial Intelligence (GATE DA)"] = 15.0
    if any(t in tokens for t in ["cs", "cse", "it"]):
        boosts["GATE Computer Science and Information Technology (GATE CS)"] = 15.0
    if any(t in tokens for t in ["me", "mech", "mechanical"]):
        boosts["GATE Mechanical Engineering (GATE ME)"] = 15.0

    # Deduplicate by entity before comparing top scores
    ranked_entities: list[tuple[str, float]] = []
    seen = set()
    for alias, score in matches:
        name = alias_pool[alias].canonical_name
        if name not in seen:
            boosted_score = score + boosts.get(name, 0.0)
            ranked_entities.append((name, boosted_score))
            seen.add(name)

    if not ranked_entities:
        return ResolutionResult(matched=False, entity=None, confidence=0.0, candidates=[])

    # Sort again after applying boosts
    ranked_entities.sort(key=lambda x: x[1], reverse=True)

    top_score = ranked_entities[0][1]
    second_score = ranked_entities[1][1] if len(ranked_entities) > 1 else 0
    is_unambiguous = (top_score - second_score) >= 10.0

    logger.info(f"🔍 Fuzzy match top_score={top_score:.1f}, second_score={second_score:.1f}, is_unambiguous={is_unambiguous}")

    if top_score >= CONFIDENCE_THRESHOLD and is_unambiguous:
        top_name = ranked_entities[0][0]
        entity = next(e for e in EXAM_REGISTRY if e.canonical_name == top_name)
        return ResolutionResult(matched=True, entity=entity, confidence=top_score, candidates=[])

    # Not confident or ambiguous -- surface top candidates
    seen_names = set()
    candidates = []
    for alias, score in matches:
        entity = alias_pool[alias]
        if entity.canonical_name not in seen_names:
            candidates.append((entity.canonical_name, score))
            seen_names.add(entity.canonical_name)

    return ResolutionResult(matched=False, entity=None, confidence=top_score, candidates=candidates)


def build_grounded_search_query(entity: ExamEntity) -> str:
    """Build a domain-restricted query from the canonical name."""
    return f'"{entity.canonical_name}" official syllabus 2026 site:{entity.official_domain}'


def verify_grounding(entity: ExamEntity, search_result_text: str, min_overlap: float = 0.3) -> bool:
    """Check if the search results contain enough core keywords of the resolved exam."""
    result_lower = search_result_text.lower()
    hits = sum(1 for topic in entity.key_topics if topic in result_lower)
    overlap = hits / max(len(entity.key_topics), 1)
    logger.info(f"📊 Grounding verification for '{entity.canonical_name}': hit {hits}/{len(entity.key_topics)} topics (overlap={overlap:.2f})")
    return overlap >= min_overlap
