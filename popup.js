document.addEventListener('DOMContentLoaded', function() {
  const normalModeBtn = document.getElementById('normalModeBtn');
  const examModeBtn = document.getElementById('examModeBtn');
  const normalModeSection = document.getElementById('normalModeSection');
  const examModeSection = document.getElementById('examModeSection');
  const websiteList = document.getElementById('websiteList');
  const startExamBtn = document.getElementById('startExamBtn');
  const signin = document.getElementById('signin');
  const invigilatorbtn = document.getElementById('invigilatorbtn');
  const studentbtn = document.getElementById('studentbtn');
  const invigilatorSection = document.getElementById('invigilatorSection');
  const studentSection = document.getElementById('studentSection');
  const invigilatorsavebtn = document.getElementById('invigilatorsavebtn');
  // const Invigilatorpassword = document.getElementById('Invigilatorpassword');
  const examname = document.getElementById('examname');
  const examurl = document.getElementById('examurl');
  const examcode_invigilator = document.getElementById('examcode-invigilator');
  const examduration = document.getElementById('examduration');

  const studentloginbtn = document.getElementById('studentloginbtn');
  // const studentpassword = document.getElementById('studentpassword');
  const examcode_student = document.getElementById('examcode-student');
  const rollno = document.getElementById('rollno');
  const examUrldisplay = document.getElementById('examUrldisplay');
  const examDurationdisplay = document.getElementById('examDurationdisplay');
   
  
  invigilatorSection.style.display = 'none';
  studentSection.style.display = 'none';
  signin.style.display = 'none';
  examModeSection.style.display = 'none';

  // Get today's date in YYYY-MM-DD format
  function getTodayDate() {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }

  // Format time duration
  function formatDuration(milliseconds) {
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (seconds > 0 || timeString === '') timeString += `${seconds}s`;
    
    return timeString.trim();
  }

  function updateWebsiteList() {
    chrome.storage.local.get(['websiteData'], function(result) {
      const websiteData = result.websiteData || {};
      const today = getTodayDate();
      const todayData = websiteData[today] || {};
      websiteList.innerHTML = '';

      // Create header with date
      const dateHeader = document.createElement('h4');
      dateHeader.textContent = `Today's Activity (${today})`;
      websiteList.appendChild(dateHeader);

      // Convert to array and sort by time in descending order
      const sortedWebsites = Object.entries(todayData)
        .sort(([, a], [, b]) => b.time - a.time);

      if (sortedWebsites.length === 0) {
        const noDataMsg = document.createElement('div');
        noDataMsg.textContent = 'No activity recorded today';
        noDataMsg.style.fontStyle = 'italic';
        noDataMsg.style.color = '#666';
        noDataMsg.style.padding = '10px 0';
        websiteList.appendChild(noDataMsg);
        return;
      }

      sortedWebsites.forEach(([url, data]) => {
        const websiteItem = document.createElement('div');
        websiteItem.className = 'website-item';
        websiteItem.style.padding = '8px 0';
        websiteItem.style.borderBottom = '1px solid #eee';

        // Create favicon container
        const faviconImg = document.createElement('img');
        faviconImg.src = data.favicon || 'default-favicon.png';
        faviconImg.width = 16;
        faviconImg.height = 16;
        faviconImg.style.marginRight = '10px';
        faviconImg.onerror = () => { faviconImg.src = 'default-favicon.png'; };

        // Create website info container
        const infoContainer = document.createElement('div');
        infoContainer.style.flexGrow = '1';

        // Website URL
        const urlDiv = document.createElement('div');
        urlDiv.textContent = url;
        urlDiv.style.fontWeight = 'bold';

        // Time display
        const timeDiv = document.createElement('div');
        timeDiv.textContent = formatDuration(data.time);
        timeDiv.style.color = '#666';
        timeDiv.style.fontSize = '0.9em';

        infoContainer.appendChild(urlDiv);
        infoContainer.appendChild(timeDiv);

        websiteItem.appendChild(faviconImg);
        websiteItem.appendChild(infoContainer);
        websiteList.appendChild(websiteItem);
      });
    });
  }

  // Update the list every second for real-time updates
  setInterval(updateWebsiteList, 1000);

  normalModeBtn.addEventListener('click', () => {
    normalModeSection.style.display = 'block';
    signin.style.display = 'none';
    invigilatorSection.style.display = 'none';
    examModeSection.style.display = 'none';
    studentSection.style.display = 'none';
    updateWebsiteList();
  });

  examModeBtn.addEventListener('click', () => {
    normalModeSection.style.display = 'none';
    signin.style.display = 'block';
  });

  invigilatorbtn.addEventListener('click', () => {
    studentSection.style.display = 'none';
    invigilatorSection.style.display = 'block';
  });

  invigilatorsavebtn.addEventListener('click', async() => {
      // invigilatorSection.style.display = 'none';
      // examModeSection.style.display = 'block';
      let exam={
        name:examname.value,
        url:examurl.value,
        code:examcode_invigilator.value,
        duration:examduration.value,
        rollnos:[],
      }
      // console.log(exam);

      await fetch('http://localhost:4000/addexam',{
        method:'POST',
        headers:{
          Accept:'application/json',
          'Content-Type':'application/json',
        },
        body:JSON.stringify(exam),
      }).then((res=>res.json())).then((data)=>{
        if(data.success){
          alert('Exam saved');
          examname.value="";
          examcode_invigilator.value="";
          examurl.value="";
          examduration.value="";
        }else{
          alert('Failed! Exam code already exist');
        }
      })

  });

  studentbtn.addEventListener('click', () => {
    examModeSection.style.display = 'none';
    invigilatorSection.style.display = 'none';
    studentSection.style.display = 'block';
  });
  let currentexam;
  studentloginbtn.addEventListener('click',async()=>{
    let request={
      code:examcode_student.value,
    }
    await fetch('http://localhost:4000/getexam',{
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/json',
      },
      body:JSON.stringify(request),
    }).then((res=>res.json())).then((data)=>{
      if(data.success){
        currentexam=data.exam;
        // console.log(currentexam);
        examUrldisplay.innerText="URL:"+ currentexam.url;
        examDurationdisplay.innerText="Duration:"+ currentexam.duration;
        examModeSection.style.display="block";
      }else{
        examModeSection.style.display="none";
        alert("Failed! Exam code doesn't exist");
      }
    })
  })
  startExamBtn.addEventListener('click', async() => {
    
    const request={
      code:currentexam.code,
      rollno:rollno.value,
    }
    let iswritten=false;
    await fetch('http://localhost:4000/addrollno',{
      method:'POST',
      headers:{
        Accept:'application/json',
        'Content-Type':'application/json',
      },
      body:JSON.stringify(request),
    }).then((res=>res.json())).then((data)=>{
      // console.log(data.success)
      if(!data.success){
        alert(request.rollno+' already written!');
        iswritten=true;
      }
    })
  if(iswritten) return;
  const examUrl = currentexam.url;
  const examDuration = currentexam.duration;

    if (!examUrl || !examDuration) {
      alert('Please enter exam URL and duration');
      return;
    }
    // console.log("came");
    chrome.runtime.sendMessage({
      action: 'startExam',
      url: examUrl,
      duration: parseInt(examDuration) * 60 * 1000 
    });
  });

  // Initial update
  updateWebsiteList();
});