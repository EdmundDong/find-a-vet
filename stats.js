import jStat from 'jstat';

function getZ(confidenceLevel) {
  // Calculate 'z' for the specified confidence level (e.g., 95%)
  const alpha = 1 - confidenceLevel;
  const z = jStat.normal.inv(1 - alpha / 2, 0, 1); // For a two-tailed test (e.g., 95% confidence interval)
  return z;
}

// const confidenceLevel = 0.95; // 95% confidence level
// const z = ;
// console.log(
//   `Z-score for ${confidenceLevel * 100}% confidence level: ${z.toFixed(2)}`
// );

export function getConfidenceInterval(avgRating, reviewCount, confidenceLevel) {
  const z = getZ(confidenceLevel);
  const standardError = Math.sqrt((avgRating * (1 - avgRating)) / reviewCount);
  const marginOfError = z * standardError;
  const lowerBound = avgRating - marginOfError;
  const upperBound = avgRating + marginOfError;

  return [lowerBound, upperBound];
}

// const avgRating = 4.6;
// const reviewCount = 49;
// const confidenceLevel = 0.95;

// const [lowerBound, upperBound] = calculateConfidenceInterval(
//   avgRating,
//   reviewCount,
//   confidenceLevel
// );
// console.log(
//   `95% Confidence Interval: ${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}`
// );

export function getWeightedRating(avgRating, reviewCount, confidenceLevel) {
  const z = getZ(confidenceLevel);
  const weightedRating =
    (avgRating +
      (z * z) / (2 * reviewCount) -
      z *
        Math.sqrt(
          (avgRating * (1 - avgRating) + (z * z) / (4 * reviewCount)) /
            reviewCount
        )) /
    (1 + (z * z) / reviewCount);

  return weightedRating;
}

// const avgRating = 4.6;
// const reviewCount = 49;

// const weightedRating = calculateWeightedRating(avgRating, reviewCount);
// console.log(`Weighted Rating: ${weightedRating.toFixed(2)}`);
