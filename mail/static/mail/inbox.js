document.addEventListener('DOMContentLoaded', function(response) {
var ii = 0;
  // Use buttons to toggle between views
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);
  document.querySelector('#compose-form').addEventListener('submit', function(res) {
    res.preventDefault();
    sendEmail();
    
  });

  initEditor();

  // By default, load the inbox
  load_mailbox('inbox');
});

const PALETTE = [
  ['#000000', '#444444', '#666666', '#999999', '#cccccc', '#eeeeee', '#f3f3f3', '#ffffff'],
  ['#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff'],
  ['#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc'],
  ['#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd'],
  ['#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0'],
  ['#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c6', '#674ea7', '#a64d79'],
  ['#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#0b5394', '#351c75', '#741b47'],
  ['#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#073763', '#20124d', '#4c1130'],
];

// Rich-text editor for the email body (compose and reply)
function initEditor() {
  const editor = document.querySelector('#compose-body');
  const toolbar = document.querySelector('#rte-toolbar');
  let savedRange = null;

  document.execCommand('defaultParagraphSeparator', false, 'div');

  // Build the background / text colour palettes
  toolbar.querySelectorAll('.rte-palette').forEach(palette => {
    PALETTE.forEach((row, i) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'rte-palette-row' + (i === 2 ? ' rte-palette-gap' : '');
      row.forEach(color => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'rte-swatch';
        swatch.style.background = color;
        swatch.title = color;
        swatch.dataset.cmd = palette.dataset.cmd;
        swatch.dataset.value = color;
        rowEl.appendChild(swatch);
      });
      palette.appendChild(rowEl);
    });
  });

  // Remember the selection inside the editor so toolbar actions apply to it
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
      updateToolbarState();
    }
  });

  function restoreSelection() {
    editor.focus();
    if (savedRange) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }

  function closeMenus(except) {
    toolbar.querySelectorAll('.rte-dropdown.open').forEach(d => {
      if (d !== except) d.classList.remove('open');
    });
  }

  // Keep focus in the editor when clicking toolbar controls
  toolbar.addEventListener('mousedown', event => event.preventDefault());

  toolbar.addEventListener('click', event => {
    const toggle = event.target.closest('.rte-toggle');
    if (toggle) {
      const dropdown = toggle.parentElement;
      closeMenus(dropdown);
      dropdown.classList.toggle('open');
      if (dropdown.querySelector('.rte-color-menu')) markCurrentColors();
      return;
    }

    const control = event.target.closest('[data-cmd]');
    if (!control) return;

    restoreSelection();
    const cmd = control.dataset.cmd;
    const value = control.dataset.value || null;
    document.execCommand('styleWithCSS', false, cmd === 'foreColor' || cmd === 'hiliteColor' || cmd === 'fontSize');
    document.execCommand(cmd, false, value);

    if (cmd === 'fontName') {
      toolbar.querySelector('.rte-font-label').firstChild.textContent = control.textContent + ' ';
    }
    if (cmd === 'foreColor') {
      toolbar.querySelector('.rte-color-a').style.borderBottomColor = value;
    }
    closeMenus();
    updateToolbarState();
  });

  document.addEventListener('click', event => {
    if (!toolbar.contains(event.target)) closeMenus();
  });

  function updateToolbarState() {
    ['bold', 'italic', 'underline', 'strikeThrough', 'insertOrderedList', 'insertUnorderedList'].forEach(cmd => {
      const btn = toolbar.querySelector(`.rte-btn[data-cmd="${cmd}"]`);
      if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
    });
  }

  // Tick the swatches that match the colours at the current selection
  function markCurrentColors() {
    const current = {
      foreColor: normalizeColor(document.queryCommandValue('foreColor')),
      hiliteColor: normalizeColor(document.queryCommandValue('backColor')),
    };
    toolbar.querySelectorAll('.rte-swatch').forEach(swatch => {
      const selected = normalizeColor(swatch.dataset.value) === current[swatch.dataset.cmd];
      swatch.classList.toggle('selected', selected);
    });
  }

  function normalizeColor(color) {
    if (!color) return '';
    const probe = document.createElement('span');
    probe.style.color = color;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    // Transparent background means "no highlight", i.e. white in the palette
    return rgb === 'rgba(0, 0, 0, 0)' ? 'rgb(255, 255, 255)' : rgb;
  }
}

// Turn a stored body (HTML from the editor, or legacy plain text) into safe HTML
function renderBody(body) {
  if (/<[a-z][\s\S]*>/i.test(body)) {
    return DOMPurify.sanitize(body);
  }
  return escapeHtml(body).replace(/\n/g, '<br>');
}

function bodyToText(body) {
  const div = document.createElement('div');
  div.innerHTML = renderBody(body);
  return div.textContent;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function compose_email() {
  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Clear out composition fields
  document.querySelector('.title-header').innerHTML = "New Email"
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').innerHTML = '';

  // Focusing compose-recipients form
  document.querySelector('#compose-recipients').focus();

  // Add event listener to send email button
  /* document.querySelector('#compose-send').addEventListener('click', function(response) {
    response.preventDefault();
    sendEmail(response)
  }) */
}

function load_mailbox(mailbox) {
  // Show the mailbox and hide other views
  document.querySelector('#emails-view').style.display = 'block';
  document.querySelector('#compose-view').style.display = 'none';

  // Show the mailbox name
  document.querySelector('#emails-view').innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;
  
  //getEmails()
  fetch(`/emails/${mailbox}`)
  .then(response => response.json())
  .then(emails => {
      mailLayout(emails, mailbox)
  });
}

function mailLayout(emails, mailbox) {
    var length = 50;
    var table = document.createElement("table")
    table.className = `table table-inbox table-hover`;

    var tblBody = document.createElement("tbody");

    for (let email of emails) {
      var row = document.createElement("tr");

      if (mailbox == 'sent') {
        send_rec = email.recipients
      } else {
        send_rec = email.sender
      }

      // body email length
      var body_text = bodyToText(email.body);
      if (body_text.length > length) {
        email_body = escapeHtml(body_text.slice(0, length)) + " ..."
      } else {
        email_body = escapeHtml(body_text)
      }
    
    if (email.read == false) {
      send_rec = send_rec.bold();
      subject = email.subject.bold();
    } else {
      send_rec = send_rec;
      subject = email.subject;
      row.className = 'read';
    }

    // row table will change the color, if email has been read
    row.innerHTML = `<td class="sender_to">${send_rec}</td>
                     <td class="body_subject">${subject} - ${email_body}</td>
                     <td class="timestamp">${email.timestamp}</td>`;      

    row.addEventListener('click', () => {
      email_detail(email.id, mailbox);
    });

    tblBody.appendChild(row);
  };

  table.appendChild(tblBody);

  document.querySelector("#emails-view").appendChild(table); 
}

  function email_detail(id, mailbox) {
    fetch(`/emails/${id}`)
    .then(response => response.json())
    .then(email => {
      
      document.querySelector("#emails-view").innerHTML = "";
      var item = document.createElement("div");
      item.className = `main-content-inner`;
      item.innerHTML = `
                        
                        
      <div class="row">
        <div class="col-12 mt-5">
          <div class="card">
            <div class="card-body">
              <div class="mail">
                <div class="row" >
                  <div class="col-md-6 mt--35 ml-20">
                    <b>From: </b> ${email.sender}
                    <b>To: </b> ${email.recipients}
                    <b>Subject: </b> ${email.subject}
                    <b>Timestamp: </b> ${email.timestamp}
                  </div>
                </div>
                <hr>
                <div class="emailbody mt--35 ml-20">
                  ${renderBody(email.body)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
                
      document.querySelector("#emails-view").appendChild(item);

      if (mailbox == "sent") return;

      var button = document.createElement("div");
      button.className = 'btn-grp-row'

      const reply = document.createElement("button")
      reply.className = 'btngroup btn btn-primary mb-3'
      reply.innerHTML = 'Reply'
      reply.addEventListener('click', () => {
        sendReply(email)
      })      

      let archive = document.createElement("button")
      archive.className = 'btngroup btn btn-outline-info mb-3'
      archive.innerHTML = 'Archive'
      archive.addEventListener("click", () => {
        isArchived(email.id, email.archived);
      })
      if (!email.archived) archive.textContent = "Archive";
      else archive.textContent = "Unarchive";
      
      button.append(reply, archive);

      document.querySelector("#emails-view").appendChild(button);

      
      isRead(email.id);
    });
  }

  function isRead(id) {
    fetch(`/emails/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        read: true,
      }),
    });
  }

  function isArchived(id, status) {
    fetch(`/emails/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        archived: !status,
      }),
    }).then(() => {
      if (status) {
        showAlert('Email has moved to inbox.', 'alert-primary')  
      } else {
        showAlert('Email has moved to archive.', 'alert-info')
      }
      setTimeout(() => load_mailbox('inbox'), 200);
    });
  }

  function showAlert(message, alertType) {
    var alert = document.querySelector("#alert_placeholder");
    alert.innerHTML += '<div id="alertdiv" class="alert ' + alertType + '"> ' +
                       '<a href="#" class="close" data-dismiss="alert" aria-label="close">&times;</a>' +
                       '<span> ' + message + '</span></div>';

    setTimeout(function() {
      document.querySelector("#alertdiv").remove();
    }, 3500);
  }

  function sendEmail() {
    var email = document.querySelector('#compose-recipients').value;
  
    if (email == '') {
      bootbox.alert("Please specify at least one recipient.");
      return;
    }

    if (!validateEmail(email)) {
      bootbox.alert("The address \""+ email +"\" in the \<b>To</b>\ field was not recognized");
      return;
    }

    fetch('/emails', {
      method: 'POST',
      body: JSON.stringify({
        recipients: document.querySelector('#compose-recipients').value,
        subject: document.querySelector('#compose-subject').value,
        body: document.querySelector('#compose-body').innerHTML
      })
    })
    .then(response => response.json())
    .then(result => {
      console.log(result)
      if (result.status == 201) {
        showAlert('Your message has been successfully sent.', 'alert-success')
        load_mailbox("sent");
      } else {
        showAlert('Failed to send message!.', 'alert-danger')
      }
    })
  }

  function validateEmail(email) {
    const reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return reg.test(String(email).toLowerCase());
  }

  function sendReply(email) {
    // Show compose view and hide other views
    document.querySelector('#emails-view').style.display = 'none';
    document.querySelector('#compose-view').style.display = 'block';
    document.querySelector('.title-header').innerHTML = "Reply Email"

    // Clear out composition fields
    document.querySelector('#compose-recipients').value = `${email.sender}`;
    if (email.subject.startsWith("Re:")){
      document.querySelector('#compose-subject').value = email.subject;
    }
    else{
      document.querySelector('#compose-subject').value = `Re: ${email.subject}`;
    }

    const body = document.querySelector('#compose-body');
    body.innerHTML = `<div><br></div><div><br></div>
      <div>On ${email.timestamp}, &lt;${escapeHtml(email.sender)}&gt; wrote:</div>
      <blockquote class="rte-quote">${renderBody(email.body)}</blockquote>`;

    // Put the cursor at the top, above the quoted message
    body.focus();
    const range = document.createRange();
    range.setStart(body.firstChild, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }