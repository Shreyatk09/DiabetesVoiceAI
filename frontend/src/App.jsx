import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

function App() {
  const [isCalling, setIsCalling] = useState(false);
  const [status, setStatus] = useState("Status: Ready to help");
  const [language, setLanguage] = useState("en");
  const [reminderTask, setReminderTask] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [showReminderModal, setShowReminderModal] = useState(false);
  
  // State to store the most recent AI response for the main replay button
  const [lastResponse, setLastResponse] = useState(null);

  const [messages, setMessages] = useState([
    { text: "Hello! Choose your language and click the phone icon to ask me anything about Diabetes.", isUser: false, lang: 'en' }
  ]);

  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
  const checkNotifications = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:5000/get_notifications');
      
      if (response.data.length > 0) {
        response.data.forEach(notification => {
          // 1. Show a browser alert
          alert(`Health Reminder: ${notification.task}`);
          
          // 2. Add it to the chat messages automatically
          setMessages(prev => [...prev, {
            text: `⏰ REMINDER: ${notification.task}`,
            isUser: false,
            lang: 'en'
          }]);
        });
      }
    } catch (err) {
      console.error("Error checking notifications:", err);
    }
  };

  // This sets up the "Polling" interval (checks every 5 seconds)
    const interval = setInterval(checkNotifications, 5000);
  
  // Cleanup: this stops the timer if the user closes the app
    return () => clearInterval(interval);
  }, []);

  // Replay function used by both the Chat button and the Main Phone button
  const handleReplay = async (text, msgLang) => {
    if (!text) return;
    try {
      setStatus("Replaying...");
      await axios.post('http://127.0.0.1:5000/replay_audio', { 
        text: text, 
        lang: msgLang 
      });
      setStatus("Status: Ready");
    } catch (err) {
      console.error("Replay error:", err);
      setStatus("Error: Could not replay.");
    }
  };

    const handleSetReminder = async () => {
      if (!reminderTask || !reminderTime) {
          alert("Please enter both task and time");
          return;
      }
      try {
          await axios.post('http://127.0.0.1:5000/set_reminder', { 
              task: reminderTask, 
              time: reminderTime 
          });
          alert(`Reminder set for ${reminderTime}`);
          setReminderTask("");
      } catch (err) {
          console.error("Error setting reminder", err);
      }
  };

  const handleCall = async () => {
    setIsCalling(true);
    setStatus("Listening...");

    try {
      const response = await axios.post('http://127.0.0.1:5000/process_voice', { 
        lang: language 
      });

      if (response.data.user_text) {
        // 1. Save this response as the "Latest" for the left panel button
        setLastResponse({
            text: response.data.assistant_response,
            lang: language
        });

        // 2. Add to chat history
        setMessages(prev => [
          ...prev, 
          { text: response.data.user_text, isUser: true, lang: language },
          { text: response.data.assistant_response, isUser: false, lang: language }
        ]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { text: "Error: Could not hear you clearly.", isUser: false, lang: 'en' }]);
    } finally {
      setIsCalling(false);
      setStatus("Status: Ready");
    }
  };

  return (
    <div className="bg-white w-[1000px] h-[700px] rounded-3xl shadow-2xl flex overflow-hidden">
      
      {/* LEFT PANEL */}
      <div className="w-1/2 bg-gradient-to-b from-blue-600 to-blue-800 p-8 flex flex-col items-center justify-between text-white relative">
        {/* BELL BUTTON - Positioned at the top-left of THIS panel */}
        <button 
          onClick={() => setShowReminderModal(true)}
          className="absolute top-6 left-6 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all border border-white/30 shadow-sm"
          title="Set Reminder"
        >
          <i className="fas fa-bell text-white text-sm"></i>
        </button>

        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Diabetes Health Assistant</h2>
          <div className="text-blue-200 text-sm">{status}</div>
        </div>
        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-blue-500 flex items-center justify-center shadow-inner relative z-10">
            <i className="fas fa-hand-holding-medical text-6xl text-white"></i>
          </div>
          <div className={`${isCalling ? '' : 'hidden'} absolute top-0 left-0 w-48 h-48 rounded-full bg-blue-400 pulse-ring`}></div>
        </div>

        <div className="flex flex-col items-center gap-4 w-full">
          <select 
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-blue-700 border-none rounded-lg px-4 py-2 text-white focus:ring-2 ring-white outline-none"
          >
            <option value="en">English</option>
            <option value="te">తెలుగు (Telugu)</option>
          </select>
          
          <div className="flex items-center gap-4">
             {/* MAIN CALL BUTTON */}
            <button 
                onClick={handleCall}
                className={`w-20 h-20 ${isCalling ? 'bg-red-500' : 'bg-green-500'} rounded-full flex items-center justify-center shadow-lg hover:opacity-90 transition-all transform active:scale-95`}
                title="Start Speaking"
            >
                <i className="fas fa-phone text-3xl text-white"></i>
            </button>

            {/* NEW: MAIN REPLAY BUTTON (Visible only if there is a last response) */}
            {lastResponse && (
                <button 
                    onClick={() => handleReplay(lastResponse.text, lastResponse.lang)}
                    className="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg hover:bg-yellow-400 transition-all transform active:scale-95"
                    title="Replay Last Answer"
                >
                    <i className="fas fa-redo text-xl text-white"></i>
                </button>
            )}
          </div>

          <p className="text-sm text-blue-100">
             {lastResponse ? "Click Phone to Speak, Yellow to Replay" : "Click the phone to start speaking"}
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-1/2 flex flex-col bg-slate-50">
        <div className="p-6 border-b bg-white text-black">
          <h3 className="font-semibold text-slate-700">Conversation History</h3>
        </div>
        
        <div ref={chatBoxRef} className="chat-container flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
          {messages.map((msg, index) => (
            <div 
              key={index}
              className={`${
                msg.isUser 
                ? "bg-blue-600 text-white self-end rounded-tr-none" 
                : "bg-white text-slate-800 self-start border border-slate-200 rounded-tl-none"
              } p-3 rounded-2xl max-w-[80%] text-sm shadow-sm flex flex-col gap-2`}
            >
              <span>{msg.text}</span>
              
              {!msg.isUser && (
                <button 
                  onClick={() => handleReplay(msg.text, msg.lang)}
                  className="self-start flex items-center gap-2 text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors mt-1 bg-blue-50 px-2 py-1 rounded-md"
                >
                  <i className="fas fa-volume-up"></i> Repeat
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {showReminderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 w-[400px] shadow-2xl relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowReminderModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <i className="fas fa-times text-xl"></i>
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-clock text-blue-600"></i> Set Health Reminder
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Task Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Take Insulin" 
                  value={reminderTask}
                  onChange={(e) => setReminderTask(e.target.value)}
                  className="w-full p-3 mt-1 rounded-xl bg-slate-100 text-black outline-none border-none focus:ring-2 ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">Alert Time</label>
                <input 
                  type="time" 
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full p-3 mt-1 rounded-xl bg-slate-100 text-black outline-none border-none focus:ring-2 ring-blue-500"
                />
              </div>

              <button 
                onClick={() => {
                  handleSetReminder();
                  setShowReminderModal(false);
                }}
                className="w-full bg-blue-600 py-3 rounded-xl font-bold text-white hover:bg-blue-700 transition-colors shadow-lg"
              >
                Save Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;