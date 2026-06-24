import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface CircularProgressProps {
  value: number;
  text?: string;
  size?: number;
  strokeWidth?: number;
  threshold?: number;
  midThreshold?: number;
  className?: string;
}

const defaultThreshold = 75;
const defaultMidThreshold = 85;

export default function CircularProgress({
  value,
  text,
  size = 80,
  strokeWidth = 8,
  threshold = defaultThreshold,
  midThreshold = defaultMidThreshold,
  className,
}: CircularProgressProps) {
  const pathColor =
    value < threshold ? "#EF4444" : value < midThreshold ? "#FACC15" : "#10B981";

  return (
    <div className={className} style={{ width: size, height: size }}>
      <CircularProgressbar
        value={value}
        text={text ?? `${value}%`}
        strokeWidth={strokeWidth}
        styles={buildStyles({
          pathColor,
          textColor: "currentColor",
          trailColor: "rgba(163, 198, 240, 0.2)",
          strokeLinecap: "round",
          pathTransitionDuration: 0.5,
        })}
      />
    </div>
  );
}
