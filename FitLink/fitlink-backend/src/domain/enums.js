export const Roles = Object.freeze({
  STUDENT: 'student',
  ADMIN: 'admin',
  PT: 'pt'
})

export const Genders = Object.freeze({
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other'
})

// Địa điểm buổi học
export const TrainingLocationType = Object.freeze({
  AT_PT_GYM: 'at_pt_gym',        // học tại phòng gym cố định của PT
  AT_CLIENT: 'at_client',        // PT đến nhà khách (home gym)
  AT_OTHER_GYM: 'at_other_gym'   // PT đến 1 phòng gym khác theo yêu cầu KH
})

// Trạng thái booking/session (tuỳ anh dùng tới đâu)
export const BookingStatus = Object.freeze({
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
})

export const SessionStatus = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  MISSED: 'missed',
  CANCELLED: 'cancelled'
})

export const PackageTags = Object.freeze({
  WEIGHT_LOSS: 'weight_loss',
  MUSCLE_GAIN: 'muscle_gain',
  REHAB: 'rehab',
  POSTURE: 'posture',
  STRENGTH: 'strength',
  ENDURANCE: 'endurance',
  GENERAL_HEALTH: 'general_health',
  NUTRITION: 'nutrition',
  COMPETITION: 'competition',
  OTHER: 'other'
});

