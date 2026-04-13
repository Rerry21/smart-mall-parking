// LOGIC:
// overstayMinutes = (exitTime - expiryTime) / 60
// finePerMinute = 10 KES (configurable)
// totalFine = overstayMinutes * finePerMinute

module.exports = function calculateFine(expiryTime, exitTime) {
  const overstayMs = exitTime - expiryTime; // milliseconds
  const overstayMinutes = Math.ceil(overstayMs / (1000 * 60));
  
  if (overstayMinutes <= 0) {
    return { overstayMinutes: 0, totalFine: 0 };
  }
  
  const finePerMinute = 10; // KES
  const totalFine = overstayMinutes * finePerMinute;
  
  return { overstayMinutes, totalFine };
};