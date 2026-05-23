// lib/events/types.ts

/**
 * Cognition event types used throughout the system. These are the high‑level
 * domain events that drive learner‑state orchestration.
 */
export enum CognitionEventType {
  MasteryChanged = 'mastery_changed',
  RetrievalSucceeded = 'retrieval_succeeded',
  RetrievalFailed = 'retrieval_failed',
  MisconceptionDetected = 'misconception_detected',
  BurnoutRiskIncreased = 'burnout_risk_increased',
  ConfidenceDropDetected = 'confidence_drop_detected',
  LearningVelocityChanged = 'learning_velocity_changed',
  RemediationCompleted = 'remediation_completed',
  StreakExtended = 'streak_extended',
  CognitiveOverloadDetected = 'cognitive_overload_detected',
}
