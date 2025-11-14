import { GoogleGenAI, Type } from "@google/genai";
import type { ResumeData } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper function to convert a File object to a GoogleGenerativeAI.Part object
async function fileToGenerativePart(file: File): Promise<{inlineData: {mimeType: string, data: string}}> {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the Base64 prefix "data:mime/type;base64,", remove it.
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to read file as string."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  const data = await base64EncodedDataPromise;
  return {
    inlineData: {
      mimeType: file.type,
      data
    },
  };
}


const resumeSchema = {
  type: Type.OBJECT,
  properties: {
    personalInfo: {
      type: Type.OBJECT,
      properties: {
        firstName: { type: Type.STRING, description: "The person's first name." },
        lastName: { type: Type.STRING, description: "The person's last name." },
        email: { type: Type.STRING, description: "The person's email address." },
        phone: { type: Type.STRING, description: "The person's phone number." },
        address: { type: Type.STRING, description: "The person's full address (City, State, Country)." },
        linkedin: { type: Type.STRING, description: "URL to the person's LinkedIn profile." },
        website: { type: Type.STRING, description: "URL to the person's personal website or portfolio." },
      },
      required: ["firstName", "lastName", "email", "phone", "address"],
    },
    workExperience: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          title: { type: Type.STRING },
          startDate: { type: Type.STRING, description: "Format as YYYY-MM" },
          endDate: { type: Type.STRING, description: "Format as YYYY-MM or 'Present'" },
          description: { type: Type.STRING, description: "A brief summary of responsibilities and achievements." },
        },
        required: ["company", "title", "startDate", "endDate", "description"],
      },
    },
    education: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          institution: { type: Type.STRING },
          degree: { type: Type.STRING },
          fieldOfStudy: { type: Type.STRING },
          startDate: { type: Type.STRING, description: "Format as YYYY-MM" },
          endDate: { type: Type.STRING, description: "Format as YYYY-MM" },
        },
        required: ["institution", "degree", "fieldOfStudy", "startDate", "endDate"],
      },
    },
    skills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A list of key skills."
    },
  },
  required: ["personalInfo", "workExperience", "education", "skills"],
};


export async function parseResume(resumeFile: File): Promise<ResumeData> {
  const prompt = `
    Analyze the following resume document and extract the information into a structured JSON format. 
    Ensure all dates are formatted as 'YYYY-MM'. If a month is not available, use '01'.
    If an end date for a job is current, use the word 'Present'.
    The output must strictly adhere to the provided JSON schema.
  `;

  try {
    const filePart = await fileToGenerativePart(resumeFile);
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{text: prompt}, filePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: resumeSchema,
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as ResumeData;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Could not parse resume using Gemini API.");
  }
}
