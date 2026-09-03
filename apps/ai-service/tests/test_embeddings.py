import math

from rag.embeddings.local_hash_embeddings import LocalHashEmbeddingProvider


async def test_embedding_is_deterministic():
    provider = LocalHashEmbeddingProvider(dimension=256)
    v1 = await provider.embed_one("RVCE CSE closing rank")
    v2 = await provider.embed_one("RVCE CSE closing rank")
    assert v1 == v2


async def test_embedding_has_configured_dimension():
    provider = LocalHashEmbeddingProvider(dimension=384)
    vec = await provider.embed_one("some admissions question")
    assert len(vec) == 384


async def test_embedding_is_l2_normalized():
    provider = LocalHashEmbeddingProvider(dimension=128)
    vec = await provider.embed_one("KCET counselling rounds and choice filling")
    norm = math.sqrt(sum(v * v for v in vec))
    assert math.isclose(norm, 1.0, abs_tol=1e-6)


async def test_empty_text_yields_zero_vector():
    provider = LocalHashEmbeddingProvider(dimension=64)
    vec = await provider.embed_one("")
    assert vec == [0.0] * 64


async def test_similar_text_scores_higher_than_unrelated_text():
    provider = LocalHashEmbeddingProvider(dimension=512)
    query = await provider.embed_one("RVCE CSE placement package")
    related = await provider.embed_one("RVCE placement package median salary CSE branch")
    unrelated = await provider.embed_one("scholarship application deadline documents required")

    def cosine(a, b):
        return sum(x * y for x, y in zip(a, b))

    assert cosine(query, related) > cosine(query, unrelated)


async def test_embed_batches_multiple_texts_in_order():
    provider = LocalHashEmbeddingProvider(dimension=64)
    texts = ["first text", "second text", "third text"]
    vectors = await provider.embed(texts)
    assert len(vectors) == 3
    # Each result should match embedding the same text individually.
    for text, vec in zip(texts, vectors):
        assert vec == await provider.embed_one(text)
