export interface QBankCourse {
  code: string;
  title: string;
}

export interface QBankPaper {
  source_id: string;
  title: string;
  file_url: string;
  source_type: string;
  exam_semester: string;
  exam_year: string;
  course_code: string;
}

export interface QBankQuestion {
  question_id: string;
  question_text: string;
  question_type: 'MCQ' | 'Descriptive' | string;
  options?: Record<string, string>;
  correct_answer?: string;
  marks?: number;
  topic_name?: string;
  source_type?: string;
  exam_semester?: string;
  exam_year?: string;
  image_url?: string;
}
