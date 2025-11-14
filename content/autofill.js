// This file is a content script that runs in the context of the Workday webpage.
// It listens for messages from the extension's popup and uses the received data
// to fill out the job application form.

import type { ResumeData, WorkExperience, Education } from '../types';

console.log('Workday Autofill content script loaded.');

// --- HELPER FUNCTIONS ---

// A small delay to allow the UI to update after actions like clicks.
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A robust function to find an element and set its value, dispatching events
// to ensure the web application's state (like React) is updated.
async function setInputValue(selector: string, value: string) {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (element && value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();
    await sleep(100); // Short delay after filling an input
  }
}

// --- MAIN FILLING LOGIC ---

async function fillMyInformation(data: ResumeData) {
    await setInputValue('input[data-automation-id="legalNameSection_firstName"]', data.personalInfo.firstName);
    await setInputValue('input[data-automation-id="legalNameSection_lastName"]', data.personalInfo.lastName);
    await setInputValue('input[data-automation-id="addressSection_addressLine1"]', data.personalInfo.address);
    await setInputValue('input[data-automation-id="email"]', data.personalInfo.email);
    await setInputValue('input[data-automation-id="phone-number"]', data.personalInfo.phone);
}

async function fillWorkExperience(jobs: WorkExperience[]) {
  const addButtonSelector = 'button[data-automation-id="Add"]';
  const workExperienceSection = document.querySelector('[data-automation-id="workExperienceSection"]');
  if (!workExperienceSection) return;

  for (const job of jobs) {
    const addButton = workExperienceSection.querySelector<HTMLButtonElement>(addButtonSelector);
    addButton?.click();
    await sleep(500); // Wait for the new section to be added to the DOM

    // Selectors are relative to the last added experience block
    const allBlocks = workExperienceSection.querySelectorAll('[data-automation-id="workExperience"]');
    const currentBlock = allBlocks[allBlocks.length-1];
    if (!currentBlock) continue;

    await setInputValueInBlock(currentBlock, '[data-automation-id="jobTitle"]', job.title);
    await setInputValueInBlock(currentBlock, '[data-automation-id="company"]', job.company);
    await setInputValueInBlock(currentBlock, '[data-automation-id="description"]', job.description);
    
    const [startYear, startMonth] = job.startDate.split('-');
    const [endYear, endMonth] = job.endDate.split('-');
    
    await setInputValueInBlock(currentBlock, '[data-automation-id="startDate-input"]', `${startMonth}/${startYear}`);
    await setInputValueInBlock(currentBlock, '[data-automation-id="endDate-input"]', job.endDate === 'Present' ? '' : `${endMonth}/${endYear}`);
    
    if (job.endDate === 'Present') {
      const currentlyWorkHereCheckbox = currentBlock.querySelector<HTMLInputElement>('input[data-automation-id="currentlyWorkHere"]');
      if (currentlyWorkHereCheckbox && !currentlyWorkHereCheckbox.checked) {
        currentlyWorkHereCheckbox.click();
      }
    }
  }
}

async function fillEducation(educations: Education[]) {
    const addButtonSelector = 'button[data-automation-id="Add"]';
    const educationSection = document.querySelector('[data-automation-id="educationSection"]');
    if (!educationSection) return;

    for(const edu of educations) {
        const addButton = educationSection.querySelector<HTMLButtonElement>(addButtonSelector);
        addButton?.click();
        await sleep(500);

        const allBlocks = educationSection.querySelectorAll('[data-automation-id="education"]');
        const currentBlock = allBlocks[allBlocks.length - 1];
        if (!currentBlock) continue;
        
        await setInputValueInBlock(currentBlock, '[data-automation-id="school"]', edu.institution);
        await setInputValueInBlock(currentBlock, '[data-automation-id="degree"]', edu.degree);
        await setInputValueInBlock(currentBlock, '[data-automation-id="fieldOfStudy"]', edu.fieldOfStudy);

        const [startYear, startMonth] = edu.startDate.split('-');
        const [endYear, endMonth] = edu.endDate.split('-');

        await setInputValueInBlock(currentBlock, 'input[data-automation-id*="startDate"]', `${startMonth}/${startYear}`);
        await setInputValueInBlock(currentBlock, 'input[data-automation-id*="endDate"]', `${endMonth}/${endYear}`);
    }
}

async function fillWebsites(data: ResumeData) {
    const websiteInputSelector = 'input[data-automation-id="website"]';
    if(data.personalInfo.linkedin) {
        await setInputValue(websiteInputSelector, data.personalInfo.linkedin);
    }
    // Note: Workday often only has one website field, so we prioritize LinkedIn.
}

async function setInputValueInBlock(block: Element, selector: string, value: string) {
    const element = block.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (element && value) {
        element.focus();
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.blur();
        await sleep(100);
    }
}


// --- MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTOFILL_DATA') {
    console.log('Received data, starting autofill...', message.payload);
    const data: ResumeData = message.payload;
    
    // Execute filling functions sequentially
    const runAutofill = async () => {
        try {
            await fillMyInformation(data);
            await fillWorkExperience(data.workExperience);
            await fillEducation(data.education);
            await fillWebsites(data);
            sendResponse({ status: 'Autofill complete!' });
        } catch (error) {
            console.error('Autofill error:', error);
            sendResponse({ status: 'Autofill failed. See console for details.' });
        }
    };

    runAutofill();

    // Return true to indicate that the response is sent asynchronously
    return true; 
  }
});
