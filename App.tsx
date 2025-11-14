import React, { useState, useCallback, useEffect } from 'react';
import { parseResume } from './services/geminiService';
import type { ResumeData, Profile } from './types';
import { BotIcon, SendIcon, AlertTriangleIcon, PlusIcon, TrashIcon, UploadCloudIcon, ChevronLeftIcon, BriefcaseIcon } from './components/icons';

// Fix: Declare chrome for extension APIs to resolve TypeScript errors.
declare const chrome: any;

const App: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileFile, setNewProfileFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillMessage, setAutofillMessage] = useState('');

  useEffect(() => {
    // Load profiles from chrome storage when the component mounts
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['profiles'], (result) => {
        if (result.profiles) {
          setProfiles(result.profiles);
        }
      });
    }
  }, []);

  const handleAutofill = useCallback((data: ResumeData) => {
    if (!data) return;
    setAutofillMessage('');

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          if (activeTab.url && activeTab.url.includes('myworkdayjobs.com')) {
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ['content/autofill.js']
            }).then(() => {
                chrome.tabs.sendMessage(activeTab.id!, { type: 'AUTOFILL_DATA', payload: data }, (response) => {
                  if (chrome.runtime.lastError) {
                    setAutofillMessage('Error: Could not connect to the page. Please refresh the Workday page and try again.');
                  } else {
                    setAutofillMessage(response?.status || 'Data sent successfully!');
                  }
                });
            }).catch(err => {
                 setAutofillMessage('Failed to run autofill script.');
                 console.error('Script injection failed:', err);
            });
          } else {
            setAutofillMessage('This extension only works on Workday job sites.');
          }
        }
      });
    } else {
      console.log('Running outside of a Chrome extension. Data to be sent:', data);
      setAutofillMessage('Not in extension environment.');
    }
  }, []);
  
  const handleSaveProfile = async () => {
    if (!newProfileFile || !newProfileName.trim()) {
      setError('Please provide a profile name and select a resume file.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const parsedData = await parseResume(newProfileFile);
      const newProfile: Profile = {
        id: Date.now().toString(),
        name: newProfileName,
        resumeFileName: newProfileFile.name,
        data: parsedData,
      };
      const updatedProfiles = [...profiles, newProfile];
      setProfiles(updatedProfiles);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ profiles: updatedProfiles });
      }
      // Reset form and switch view
      setView('list');
      setNewProfileName('');
      setNewProfileFile(null);
    } catch (err) {
      console.error(err);
      setError('Failed to parse resume. The file might be corrupted or in an unsupported format. Please try another file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProfile = (profileId: string) => {
    const updatedProfiles = profiles.filter(p => p.id !== profileId);
    setProfiles(updatedProfiles);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ profiles: updatedProfiles });
    }
  };
  
  const renderListView = () => (
    <>
      <main className="flex-grow overflow-y-auto p-4 space-y-3">
        {profiles.length === 0 ? (
            <div className="text-center text-slate-500 pt-16">
                <BriefcaseIcon className="mx-auto w-12 h-12 text-slate-300" />
                <h3 className="mt-2 text-lg font-semibold">No Profiles Found</h3>
                <p className="text-sm">Click "Add New Profile" to upload your first resume.</p>
            </div>
        ) : (
          profiles.map(profile => (
            <div key={profile.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800">{profile.name}</p>
                <p className="text-xs text-slate-500">{profile.resumeFileName}</p>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => handleDeleteProfile(profile.id)} 
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  aria-label={`Delete ${profile.name} profile`}
                  >
                  <TrashIcon />
                </button>
                <button 
                  onClick={() => handleAutofill(profile.data)}
                  className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center transition-colors text-sm"
                >
                  <SendIcon />
                  <span className="ml-2">Autofill</span>
                </button>
              </div>
            </div>
          ))
        )}
         {autofillMessage && <p className="text-center text-sm mt-2 p-2 bg-slate-100 rounded-md text-slate-600">{autofillMessage}</p>}
      </main>
      <footer className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200">
        <button
          onClick={() => { setView('add'); setError(null); setAutofillMessage(''); }}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 flex items-center justify-center transition-colors duration-200"
        >
          <PlusIcon />
          <span className="ml-2">Add New Profile</span>
        </button>
      </footer>
    </>
  );
  
  const renderAddView = () => (
     <>
      <main className="flex-grow overflow-y-auto p-4">
        <div className="mb-4">
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1">Profile Name</label>
          <input
            type="text"
            id="profile-name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="e.g., Senior Developer Resume"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <div>
          <label htmlFor="resume-file" className="block text-sm font-medium text-slate-700 mb-1">Resume File</label>
          <label
            htmlFor="resume-upload"
            className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <UploadCloudIcon />
            <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-slate-500">PDF or DOCX (MAX. 10MB)</p>
            <input id="resume-upload" type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => setNewProfileFile(e.target.files ? e.target.files[0] : null)} />
          </label>
          {newProfileFile && <p className="text-sm text-slate-600 mt-2">Selected: {newProfileFile.name}</p>}
        </div>

        {error && (
          <div className="mt-3 flex items-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            <AlertTriangleIcon />
            <span className="ml-2">{error}</span>
          </div>
        )}

         {isLoading && (
            <div className="flex flex-col items-center justify-center h-32">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="mt-3 text-slate-600">Analyzing resume with AI...</p>
            </div>
        )}
      </main>

      <footer className="p-4 bg-white/80 backdrop-blur-sm border-t border-slate-200 grid grid-cols-2 gap-3">
        <button
          onClick={() => { setView('list'); setError(null); }}
          className="w-full bg-slate-200 text-slate-800 font-bold py-3 px-4 rounded-lg hover:bg-slate-300 flex items-center justify-center transition-colors duration-200"
        >
          <ChevronLeftIcon />
          <span className="ml-1">Cancel</span>
        </button>
        <button
          onClick={handleSaveProfile}
          disabled={isLoading || !newProfileFile || !newProfileName}
          className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-200"
        >
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </footer>
    </>
  );

  return (
    <div className="flex flex-col h-[550px] font-sans bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center">
            <BotIcon />
            <h1 className="text-lg font-bold text-slate-800 ml-2">Workday Autofill</h1>
        </div>
      </header>
      
      {view === 'list' ? renderListView() : renderAddView()}
      
    </div>
  );
};

export default App;
