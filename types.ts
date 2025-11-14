export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  linkedin: string;
  website: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  startDate: string; // e.g., "YYYY-MM"
  endDate: string; // e.g., "YYYY-MM" or "Present"
  description: string;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string; // e.g., "YYYY-MM"
  endDate: string; // e.g., "YYYY-MM"
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
}

export interface Profile {
  id: string;
  name: string;
  resumeFileName: string;
  data: ResumeData;
}
