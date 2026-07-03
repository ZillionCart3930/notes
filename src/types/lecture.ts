/** Post-processing summary length (pre-computed tiers). */
export type SummaryLength = 'small' | 'medium' | 'long';

export const SUMMARY_LENGTH_OPTIONS: {
  value: SummaryLength;
  label: string;
  percent: string;
}[] = [
  { value: 'small', label: 'Small', percent: '15%' },
  { value: 'medium', label: 'Medium', percent: '40%' },
  { value: 'long', label: 'Long', percent: '75%' },
];

export type LectureRecorderStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'error';
