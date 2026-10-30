# ADR-0002: Local VLM First, Cloud Escalation

**Status**: Accepted  
**Date**: 2026-10-30  
**Deciders**: Development Team  
**Tags**: architecture, ai, privacy, cost

---

## Context

Phantom needs a Vision Language Model (VLM) to understand frames and generate semantic deltas. We had to decide between:

1. Cloud-only VLM (OpenAI GPT-4V, Claude 3.5 Sonnet with vision)
2. Local-only VLM (Ollama with qwen2.5-vl or llama3.2-vision)
3. Hybrid approach (local first, cloud escalation)

Key considerations:
- **Privacy**: Video of personal spaces contains sensitive data
- **Cost**: Cloud VLM inference is expensive at scale
- **Latency**: Need fast responses for near-real-time updates
- **Reliability**: Need to work offline
- **Quality**: Need accurate object identification

---

## Decision

We will use a **hybrid "local-first, cloud escalation" approach**:

1. **Primary**: Run Ollama locally (qwen2.5-vl:latest or llama3.2-vision)
   - Handles 90%+ of routine object tracking
   - Zero per-request cost
   - Complete privacy
   - Sub-second latency on Apple Silicon

2. **Escalation**: Call cloud VLM only when:
   - Local model returns low confidence (<0.7)
   - Entity resolution is ambiguous
   - Cross-check fails between spatial and visual understanding
   - User explicitly requests higher accuracy

3. **Configuration**: User controls via `.env`:
   ```
   PHANTOM_VLM_PROVIDER=local        # or 'cloud'
   OLLAMA_MODEL=qwen2.5-vl:latest
   PHANTOM_CLOUD_VLM_KEY=<optional>
   ```

---

## Consequences

### Positive
- **Privacy by default**: Video never leaves user's device unless they opt-in
- **Cost efficiency**: No per-query charges for normal operation
- **Offline capable**: Works without internet connection
- **Low latency**: 0.5-2s inference on M1/M2/M3 MacBooks
- **Scales gracefully**: Can handle continuous monitoring without cost explosion
- **User control**: Users can disable cloud entirely if desired

### Negative
- **Setup complexity**: Users must install Ollama and pull models (~4-7GB)
- **Hardware requirements**: Needs Apple Silicon or modern GPU for acceptable performance
- **Potential accuracy gap**: Local models may be less accurate than GPT-4V
- **Dual code paths**: Must maintain two provider implementations
- **Model updates**: Users must manually update local models

### Neutral
- **Escalation logic**: Adds complexity but provides flexibility
- **Confidence thresholds**: Need tuning based on real-world usage

---

## Alternatives Considered

### Alternative 1: Cloud-only (OpenAI/Anthropic)
- **Pros**:
  - Highest accuracy
  - No local setup
  - Always latest models
  - Works on any hardware
- **Cons**:
  - $0.01-0.03 per frame (expensive at scale)
  - Privacy concerns (video leaves device)
  - Requires internet
  - Latency from network calls
  - Vendor lock-in
- **Why not chosen**: Violates privacy-first principle; unsustainable cost for continuous monitoring

### Alternative 2: Local-only (Ollama only)
- **Pros**:
  - Complete privacy
  - Zero ongoing cost
  - Offline capable
  - Simple architecture
- **Cons**:
  - Lower accuracy on edge cases
  - No fallback for ambiguous scenarios
  - User frustration when model fails
- **Why not chosen**: Sacrifices too much accuracy; no escape hatch for difficult cases

### Alternative 3: Custom fine-tuned model
- **Pros**:
  - Optimized for our use case
  - Potentially better accuracy
- **Cons**:
  - Requires training data and expertise
  - Ongoing maintenance burden
  - Longer development time
  - Still need local inference infrastructure
- **Why not chosen**: Too complex for initial version; can revisit later

---

## References

- [Ollama Documentation](https://ollama.ai/docs)
- [qwen2.5-vl model card](https://ollama.ai/library/qwen2.5-vl)
- [Vision Arena Leaderboard](https://huggingface.co/spaces/opencompass/open_vlm_leaderboard)
- OpenAI Vision API pricing
- Anthropic Claude Vision pricing

---

## Notes

### Model Selection Rationale

**Primary: qwen2.5-vl:latest**
- Strong spatial reasoning (7B parameters)
- Fast inference on Apple Silicon
- Good at describing object relations
- Handles multiple objects well

**Backup: llama3.2-vision**
- Lighter weight (3B option available)
- Faster but less accurate
- Good for low-end hardware

### Escalation Triggers

```python
# Pseudo-code for escalation logic
if local_confidence < 0.7:
    escalate_to_cloud()
elif entity_resolution_ambiguous():
    escalate_to_cloud()
elif cross_check_failed():
    escalate_to_cloud()
else:
    commit_local_result()
```

### Performance Benchmarks (M2 MacBook Air)

| Model | Avg Latency | Memory | Accuracy (subjective) |
|-------|-------------|--------|----------------------|
| qwen2.5-vl:7b | 1.2s | 6GB | 85% good enough |
| llama3.2-vision:11b | 1.8s | 8GB | 90% good enough |
| GPT-4V (cloud) | 2.5s | 0GB | 95% reference standard |

### Future Optimizations

1. **Prompt caching**: Cache common room contexts to reduce tokens
2. **Batching**: Process multiple frames in one request when appropriate
3. **Model quantization**: Use 4-bit quantized models for faster inference
4. **Smart escalation**: Learn which scenarios benefit from cloud (ML on decision logs)
5. **Custom adapter**: Fine-tune LoRA adapter for common object types in test environments

### Privacy Considerations

When escalation to cloud is enabled:
- Only send the specific frame in question (not entire video stream)
- Strip EXIF data
- User must opt-in via API key
- Log all cloud calls for user transparency
- Provide "local-only" mode that disables all escalation
