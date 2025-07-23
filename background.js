// Website tracking data
let websiteData = {};
let activeTab = null;
let trackingInterval = null;
let examTabId = null;
let isSubmitting = false; // Flag to prevent multiple submissions

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

// Initialize or load existing website data
function initializeWebsiteData() {
  chrome.storage.local.get(['websiteData'], function(result) {
    websiteData = result.websiteData || {};
    const today = getTodayDate();
    if (!websiteData[today]) {
      websiteData[today] = {};
    }
    cleanupOldData();
    saveWebsiteData();
  });
}

// Clean up data older than 30 days
function cleanupOldData() {
  const dates = Object.keys(websiteData).sort();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
  
  dates.forEach(date => {
    if (date < cutoffDate) {
      delete websiteData[date];
    }
  });
}

// Save website tracking data
function saveWebsiteData() {
  chrome.storage.local.set({ websiteData });
}

// Function to submit Google Form
async function submitGoogleForm(tabId) {
  if (isSubmitting) return; // Prevent multiple submissions
  isSubmitting = true;

  try {
    // First attempt - using executeScript
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: () => {
        return new Promise((resolve) => {
          if (window.location.hostname.includes('docs.google.com') && 
              window.location.pathname.includes('/forms/')) {
            try {
              // Try all possible submit button selectors
              const submitButtons = [
                document.querySelector('div[role="button"][jsname="M2UYVd"]'),
                document.querySelector('div[role="button"].freebirdFormviewerViewNavigationSubmitButton'),
                document.querySelector('div[role="button"][aria-label*="Submit"]'),
                document.querySelector('div[role="button"][data-mdc-dialog-action="ok"]'),
                ...Array.from(document.querySelectorAll('div[role="button"]')).filter(el => 
                  el.textContent.toLowerCase().includes('submit'))
              ];

              const submitButton = submitButtons.find(btn => btn);
              
              if (submitButton) {
                // Simulate real click
                submitButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                submitButton.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                
                // Also try native click
                submitButton.click();
                
                // Try form submit as backup
                const form = document.querySelector('form');
                if (form) {
                  form.submit();
                }
                
                resolve(true);
              } else {
                // Try direct form submission if no button found
                const form = document.querySelector('form');
                if (form) {
                  form.submit();
                  resolve(true);
                }
              }
            } catch (error) {
              console.error('Form submission error:', error);
            }
          }
          resolve(false);
        });
      }
    });

    // Wait a bit to ensure submission completes
    await new Promise(resolve => setTimeout(resolve, 500));
  } catch (error) {
    console.error('Error in submitGoogleForm:', error);
  } finally {
    isSubmitting = false;
  }
}

// Enhanced exam tab closure
async function closeExamTab() {
  if (examTabId) {
    const tabId = examTabId;
    
    try {
      // Attempt to submit the form
      await submitGoogleForm(tabId);
      
      // Clear exam tab ID before closing
      examTabId = null;
      
      // Close the tab
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.remove(tabId);
        }
        
        // Restore window state
        chrome.windows.getCurrent((window) => {
          if (window) {
            chrome.windows.update(window.id, { state: 'maximized' });
          }
        });
      });
    } catch (error) {
      console.error('Error in closeExamTab:', error);
      // Ensure tab closes even if submission fails
      examTabId = null;
      chrome.tabs.remove(tabId);
    }
  }
}

// Track active tab
function trackActiveTab(tabId, url) {
  if (trackingInterval) {
    clearInterval(trackingInterval);
  }

  try {
    const hostname = new URL(url).hostname;
    const today = getTodayDate();

    if (!websiteData[today]) {
      websiteData[today] = {};
    }
    if (!websiteData[today][hostname]) {
      websiteData[today][hostname] = {
        time: 0,
        favicon: null
      };
    }

    trackingInterval = setInterval(() => {
      if (websiteData[today][hostname]) {
        websiteData[today][hostname].time += 1000;
        saveWebsiteData();
      }
    }, 1000);

    chrome.tabs.get(tabId, (tab) => {
      if (!chrome.runtime.lastError && tab && tab.favIconUrl) {
        websiteData[today][hostname].favicon = tab.favIconUrl;
        saveWebsiteData();
      }
    });
  } catch (error) {
    console.error('Error tracking tab:', error);
  }
}

// Tab update listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    trackActiveTab(tabId, tab.url);
  }
});

// Tab activation listener
chrome.tabs.onActivated.addListener((activeInfo) => {
  if (examTabId && activeInfo.tabId !== examTabId) {
    closeExamTab();
    return;
  }

  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.startsWith('http')) {
      trackActiveTab(activeInfo.tabId, tab.url);
    }
  });
});

// Enhanced window focus listener
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (examTabId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      closeExamTab();
    } else {
      chrome.windows.get(windowId, { populate: true }, (window) => {
        if (!window.tabs.some(tab => tab.id === examTabId)) {
          closeExamTab();
        }
      });
    }
  }
});

// Message listener for exam mode
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'startExam') {
    if (trackingInterval) {
      clearInterval(trackingInterval);
    }

    chrome.tabs.create({ 
      url: message.url, 
      active: true 
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Error creating exam tab:', chrome.runtime.lastError);
        return;
      }

      examTabId = tab.id;
      const examWindowId = tab.windowId;

      chrome.tabs.onUpdated.addListener(function tabLoadListener(tabId, changeInfo, tabInfo) {
        if (tabId === examTabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(tabLoadListener);

          let lastActivityTime = Date.now();
          let hasStarted = false;

          const focusCheckInterval = setInterval(() => {
            chrome.windows.getCurrent((currentWindow) => {
              if (!examTabId) {
                clearInterval(focusCheckInterval);
                return;
              }

              if (!currentWindow || !currentWindow.focused) {
                closeExamTab();
                return;
              }

              chrome.windows.get(currentWindow.id, { populate: true }, (window) => {
                if (!window.tabs.some(tab => tab.id === examTabId)) {
                  closeExamTab();
                  return;
                }

                if (window.state !== 'fullscreen') {
                  closeExamTab();
                  return;
                }
              });
            });
          }, 1000); // Check every second instead of 100ms

          chrome.windows.update(examWindowId, { state: 'fullscreen' }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error entering fullscreen:', chrome.runtime.lastError);
              clearInterval(focusCheckInterval);
              closeExamTab();
              return;
            }

            chrome.scripting.executeScript({
              target: { tabId: examTabId },
              function: () => {
                // Monitor user activity
                const resetTimer = () => {
                  chrome.runtime.sendMessage({ action: 'activity' });
                };

                // Track user activity
                ['mousemove', 'keydown', 'scroll', 'click'].forEach(event => {
                  document.addEventListener(event, resetTimer);
                });

                // Security monitoring
                document.addEventListener('fullscreenchange', () => {
                  if (!document.fullscreenElement) {
                    chrome.runtime.sendMessage({ action: 'fullscreenExit' });
                  }
                });

                document.addEventListener('keydown', function(e) {
                  const blockedKeys = ['Meta', 'Windows', 'F11', 'Escape'];
                  
                  // Allow standalone Alt key
                  if (e.key === 'Alt' && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                      return;
                  }
                  
                  // Block Alt + Tab and other Alt combinations that switch focus
                  if (e.altKey && (
                      e.key === 'Tab' ||     // Alt + Tab
                      e.key === 'F4' ||      // Alt + F4
                      e.key === 'Space' ||   // Alt + Space (window menu)
                      e.key === 'Enter' ||   // Alt + Enter
                      e.key === 'Home' ||    // Alt + Home
                      e.key === 'ArrowLeft' || // Alt + Left Arrow
                      e.key === 'ArrowRight'   // Alt + Right Arrow
                  )) {
                      e.preventDefault();
                      e.stopPropagation();
                      chrome.runtime.sendMessage({ action: 'windowBlur' });
                      return false;
                  }
                  
                  // Handle Ctrl + W and other blocked keys
                  if ((e.ctrlKey && e.key === 'w') || 
                      (e.ctrlKey && e.key === 'W') ||
                      blockedKeys.includes(e.key)) {
                      e.preventDefault();
                      chrome.runtime.sendMessage({ action: 'windowBlur' });
                  }
                }, true);
                
                window.addEventListener('blur', () => {
                  chrome.runtime.sendMessage({ action: 'windowBlur' });
                });

                document.addEventListener('contextmenu', e => e.preventDefault());
                document.addEventListener('selectstart', e => e.preventDefault());
                
                document.addEventListener('visibilitychange', () => {
                  if (document.hidden) {
                    chrome.runtime.sendMessage({ action: 'pageHidden' });
                  }
                });

                window.addEventListener('beforeunload', (e) => {
                  chrome.runtime.sendMessage({ action: 'windowBlur' });
                });

                document.documentElement.requestFullscreen().catch(console.error);
              }
            }).catch(error => {
              console.error('Script injection failed:', error);
              clearInterval(focusCheckInterval);
              closeExamTab();
            });

            // Add timer display
            chrome.scripting.insertCSS({
              target: { tabId: examTabId },
              css: `#examTimer { position: fixed; top: 10px; right: 10px; background: rgba(0, 0, 0, 0.8); color: white; padding: 10px 20px; border-radius: 5px; font-size: 20px; z-index: 999999; }`
            }).catch(console.error);

            chrome.scripting.executeScript({
              target: { tabId: examTabId },
              function: () => {
                const timerDiv = document.createElement('div');
                timerDiv.id = 'examTimer';
                document.body.appendChild(timerDiv);
              }
            }).catch(console.error);

            let remainingTime = message.duration;
            const timerInterval = setInterval(() => {
              if (!examTabId) {
                clearInterval(timerInterval);
                return;
              }

              chrome.scripting.executeScript({
                target: { tabId: examTabId },
                function: (time) => {
                  const minutes = Math.floor(time / (1000 * 60));
                  const seconds = Math.floor((time % (1000 * 60)) / 1000);
                  const timer = document.getElementById('examTimer');
                  if (timer) {
                    timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                  }
                },
                args: [remainingTime]
              }).catch(() => {
                clearInterval(timerInterval);
                clearInterval(focusCheckInterval);
                closeExamTab();
              });

              remainingTime -= 1000;
              
              if (remainingTime <= 0) {
                clearInterval(timerInterval);
                clearInterval(focusCheckInterval);
                submitGoogleForm(examTabId).then(() => {
                  closeExamTab();
                });
              }
            }, 1000);

            chrome.runtime.onMessage.addListener((message) => {
              if (message.action === 'activity') {
                lastActivityTime = Date.now();
              }
            });

            const exitHandler = (message) => {
              if (['fullscreenExit', 'pageHidden', 'windowBlur'].includes(message.action)) {
                clearInterval(timerInterval);
                clearInterval(focusCheckInterval);
                chrome.runtime.onMessage.removeListener(exitHandler);
                submitGoogleForm(examTabId).then(() => {
                  closeExamTab();
                });
              }
            };
            chrome.runtime.onMessage.addListener(exitHandler);
          });
        }
      });
    });
  }
});

// Initialize on extension load
initializeWebsiteData();