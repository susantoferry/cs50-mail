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
  initAttachments();
  initViewer();

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

// Must match MAX_ATTACHMENTS_SIZE in views.py (Vercel rejects bodies over 4.5 MB)
const MAX_ATTACHMENTS_SIZE = 4 * 1024 * 1024;
const PAPERCLIP = '<svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>';

// Files picked for the email being composed
let composeFiles = [];

// Thread the email being composed belongs to ('' starts a new conversation)
let replyThreadId = '';

function initAttachments() {
  const input = document.querySelector('#compose-files');
  const wrapper = document.querySelector('.rte-wrapper');

  document.querySelector('#compose-attach').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    addAttachments(input.files);
    input.value = '';  // so picking the same file again still fires "change"
  });

  // Files can also be dragged onto the message box
  wrapper.addEventListener('dragover', event => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    wrapper.classList.add('dragging');
  });
  wrapper.addEventListener('dragleave', () => wrapper.classList.remove('dragging'));
  wrapper.addEventListener('drop', event => {
    wrapper.classList.remove('dragging');
    if (!event.dataTransfer.files.length) return;
    event.preventDefault();
    addAttachments(event.dataTransfer.files);
  });
}

function addAttachments(files) {
  files = [...files];
  const total = [...composeFiles, ...files].reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_ATTACHMENTS_SIZE) {
    bootbox.alert(`Attachments must be ${formatSize(MAX_ATTACHMENTS_SIZE)} or less in total.`);
    return;
  }
  composeFiles.push(...files);
  renderAttachments();
}

function clearAttachments() {
  composeFiles = [];
  renderAttachments();
}

function renderAttachments() {
  const list = document.querySelector('#compose-attachments');
  list.innerHTML = '';
  composeFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.innerHTML = `<span class="attachment-name">${escapeHtml(file.name)}</span>
                      <span class="attachment-size">(${formatSize(file.size)})</span>
                      <button type="button" class="attachment-remove" title="Remove attachment">&times;</button>`;
    chip.querySelector('.attachment-remove').addEventListener('click', () => {
      composeFiles.splice(index, 1);
      renderAttachments();
    });
    list.appendChild(chip);
  });
}

function attachmentLinks(attachments) {
  if (!attachments.length) return '';
  const links = attachments.map((attachment, index) => {
    const title = `${attachment.previewable ? 'View' : 'Download'} ${escapeHtml(attachment.filename)}`;
    const attrs = `href="/attachments/${attachment.id}" data-index="${index}" title="${title}" ${attachment.previewable ? '' : 'download'}`;

    // Images get a thumbnail, like Gmail
    if (attachment.previewable && attachment.content_type.startsWith('image/')) {
      return `
        <a class="attachment-link attachment-tile" ${attrs}>
          <img src="/attachments/${attachment.id}?inline=1" alt="" loading="lazy">
          <span class="attachment-tile-name">${PAPERCLIP}<span class="attachment-name">${escapeHtml(attachment.filename)}</span></span>
        </a>`;
    }
    return `
      <a class="attachment-link attachment-chip" ${attrs}>
        ${PAPERCLIP}
        <span class="attachment-name">${escapeHtml(attachment.filename)}</span>
        <span class="attachment-size">(${formatSize(attachment.size)})</span>
      </a>`;
  }).join('');
  const label = attachments.length === 1 ? 'One attachment' : `${attachments.length} attachments`;
  return `<div class="email-attachments"><div class="attachment-label">${label}</div><div class="attachment-list">${links}</div></div>`;
}

// Previewable attachments open in the viewer; the rest download as before
function bindAttachmentPreviews(container, attachments) {
  const previewable = attachments.filter(attachment => attachment.previewable);
  container.querySelectorAll('.email-attachments .attachment-link').forEach(link => {
    const attachment = attachments[link.dataset.index];
    if (!attachment.previewable) return;
    link.addEventListener('click', event => {
      event.preventDefault();
      openViewer(previewable, previewable.indexOf(attachment));
    });
  });
}

const viewer = {items: [], index: 0};

function initViewer() {
  const el = document.querySelector('#viewer');
  el.querySelector('.viewer-close').addEventListener('click', closeViewer);
  el.querySelector('.viewer-prev').addEventListener('click', () => showViewerItem(viewer.index - 1));
  el.querySelector('.viewer-next').addEventListener('click', () => showViewerItem(viewer.index + 1));

  // Clicking the dark background (not the file itself) closes the viewer
  el.querySelector('.viewer-stage').addEventListener('click', event => {
    if (event.target.classList.contains('viewer-stage') || event.target.classList.contains('viewer-content')) {
      closeViewer();
    }
  });

  document.addEventListener('keydown', event => {
    if (el.hidden) return;
    if (event.key === 'Escape') closeViewer();
    if (event.key === 'ArrowLeft') showViewerItem(viewer.index - 1);
    if (event.key === 'ArrowRight') showViewerItem(viewer.index + 1);
  });
}

function openViewer(items, index) {
  viewer.items = items;
  document.querySelector('#viewer').hidden = false;
  document.body.classList.add('viewer-open');
  showViewerItem(index);
}

function closeViewer() {
  document.querySelector('#viewer').hidden = true;
  document.body.classList.remove('viewer-open');
  document.querySelector('#viewer .viewer-content').innerHTML = '';  // stops audio/video
}

function showViewerItem(index) {
  if (index < 0 || index >= viewer.items.length) return;
  viewer.index = index;

  const el = document.querySelector('#viewer');
  const attachment = viewer.items[index];
  const url = `/attachments/${attachment.id}`;
  const inlineUrl = `${url}?inline=1`;
  const type = attachment.content_type;

  el.querySelector('.viewer-name').textContent = attachment.filename;
  el.querySelector('.viewer-count').textContent = viewer.items.length > 1 ? `${index + 1} of ${viewer.items.length}` : '';
  el.querySelector('.viewer-download').href = url;
  el.querySelector('.viewer-open').href = inlineUrl;
  el.querySelector('.viewer-prev').hidden = index === 0;
  el.querySelector('.viewer-next').hidden = index === viewer.items.length - 1;

  const content = el.querySelector('.viewer-content');
  content.innerHTML = '';
  let media;
  if (type.startsWith('image/')) {
    media = document.createElement('img');
    media.alt = attachment.filename;
  } else if (type === 'application/pdf') {
    media = document.createElement('iframe');
    media.title = attachment.filename;
  } else if (type.startsWith('video/') || type.startsWith('audio/')) {
    media = document.createElement(type.startsWith('video/') ? 'video' : 'audio');
    media.controls = true;
    media.autoplay = true;
  } else {
    media = document.createElement('pre');
    media.textContent = 'Loading…';
    fetch(inlineUrl)
      .then(response => response.text())
      .then(text => { media.textContent = text; })
      .catch(() => { media.textContent = 'Could not load this file.'; });
  }
  media.classList.add('viewer-media', `viewer-${media.tagName.toLowerCase()}`);
  if (media.tagName !== 'PRE') media.src = inlineUrl;
  content.appendChild(media);
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  // Also escape quotes so the result is safe inside HTML attributes
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  clearAttachments();
  replyThreadId = '';

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

  // One row per conversation, like Gmail
  fetch(`/threads/${mailbox}`)
  .then(response => response.json())
  .then(threads => {
      mailLayout(threads, mailbox)
  });
}

function mailLayout(threads, mailbox) {
  const length = 80;
  const table = document.createElement("table");
  table.className = `table table-inbox table-hover`;
  const tblBody = document.createElement("tbody");

  for (const thread of threads) {
    const row = document.createElement("tr");
    row.className = thread.read ? 'read' : 'unread';

    // Sent shows who it went to; other mailboxes show who took part
    const people = mailbox == 'sent' ? thread.recipients.map(email => `To: ${displayName(email)}`) : thread.senders.map(displayName);
    const count = thread.count > 1 ? ` <span class="thread-count">${thread.count}</span>` : '';

    let snippet = bodyToText(splitQuote(renderBody(thread.body)).main).trim();
    if (snippet.length > length) snippet = snippet.slice(0, length) + " ...";

    row.innerHTML = `<td class="sender_to">${escapeHtml(people.join(', '))}${count}</td>
                     <td class="body_subject"><span class="subject">${escapeHtml(thread.subject)}</span>
                       <span class="snippet"> - ${escapeHtml(snippet)}</span></td>
                     <td class="timestamp">${thread.has_attachments ? PAPERCLIP : ''}${thread.timestamp}</td>`;

    row.addEventListener('click', () => {
      open_thread(thread.thread_id, mailbox);
    });
    tblBody.appendChild(row);
  }

  table.appendChild(tblBody);
  document.querySelector("#emails-view").appendChild(table);
}

function open_thread(threadId, mailbox) {
  fetch(`/threads/${threadId}`)
  .then(response => response.json())
  .then(thread => {
    const view = document.querySelector("#emails-view");
    view.innerHTML = "";

    const container = document.createElement("div");
    container.className = 'thread';
    container.innerHTML = `<h3 class="thread-subject">${escapeHtml(thread.subject)}</h3>`;

    // Older messages start collapsed; the latest and any unread ones start open
    const messages = thread.emails;
    messages.forEach((email, index) => {
      const expanded = index === messages.length - 1 || !email.read;
      container.appendChild(renderMessage(email, expanded));
    });
    view.appendChild(container);

    const actions = document.createElement("div");
    actions.className = 'btn-grp-row';

    const reply = document.createElement("button");
    reply.className = 'btngroup btn btn-primary mb-3';
    reply.textContent = 'Reply';
    reply.addEventListener('click', () => sendReply(thread));
    actions.append(reply);

    if (mailbox != "sent") {
      const archived = messages.some(email => email.archived);
      const archive = document.createElement("button");
      archive.className = 'btngroup btn btn-outline-info mb-3';
      archive.textContent = archived ? "Unarchive" : "Archive";
      archive.addEventListener("click", () => archiveThread(threadId, archived));
      actions.append(archive);
    }
    view.appendChild(actions);

    if (messages.some(email => !email.read)) {
      updateThread(threadId, {read: true});
    }
  });
}

// One message in a conversation: a clickable header, then body and attachments
function renderMessage(email, expanded) {
  const message = document.createElement("div");
  message.className = 'message' + (expanded ? ' expanded' : '');

  const {main, quote} = splitQuote(renderBody(email.body));
  const snippet = bodyToText(main).trim();
  const to = 'to ' + email.recipients.map(displayName).join(', ');

  message.innerHTML = `
    <div class="message-header" title="Click to expand or collapse">
      <div class="avatar" style="background: ${avatarColor(email.sender)}">${escapeHtml(email.sender.charAt(0).toUpperCase())}</div>
      <div class="message-meta">
        <div class="message-from">${escapeHtml(email.sender)}</div>
        <div class="message-to">${escapeHtml(to)}</div>
        <div class="message-snippet">${escapeHtml(snippet)}</div>
      </div>
      <div class="message-time">${email.attachments.length ? PAPERCLIP : ''}${email.timestamp}</div>
    </div>
    <div class="message-body">
      <div class="emailbody">${main}</div>
      ${quote ? `<button type="button" class="quote-toggle" title="Show trimmed content">&bull;&bull;&bull;</button>
                 <div class="message-quote" hidden>${quote}</div>` : ''}
      ${attachmentLinks(email.attachments)}
    </div>`;

  message.querySelector('.message-header').addEventListener('click', () => {
    message.classList.toggle('expanded');
  });
  const toggle = message.querySelector('.quote-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const trimmed = message.querySelector('.message-quote');
      trimmed.hidden = !trimmed.hidden;
    });
  }
  bindAttachmentPreviews(message, email.attachments);
  return message;
}

// Separate a reply from the "On ... wrote:" history quoted below it, which the
// conversation already shows as earlier messages
function splitQuote(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  const blockquote = [...root.children].find(el => el.matches('blockquote.rte-quote'));
  if (!blockquote) return {main: html, quote: ''};

  let start = blockquote;
  const intro = blockquote.previousElementSibling;
  if (intro && /^\s*On .* wrote:\s*$/.test(intro.textContent)) start = intro;

  const quote = document.createElement('div');
  while (start) {
    const next = start.nextSibling;
    quote.appendChild(start);
    start = next;
  }
  return {main: root.innerHTML, quote: quote.innerHTML};
}

function currentUser() {
  return JSON.parse(document.querySelector('#user-email').textContent);
}

function displayName(email) {
  return email === currentUser() ? 'me' : email;
}

function avatarColor(text) {
  const colors = ['#1a73e8', '#d93025', '#188038', '#e37400', '#9334e6', '#c5221f', '#12b5cb', '#e52592', '#689f38', '#795548'];
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}

function updateThread(threadId, data) {
  return fetch(`/threads/${threadId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

function archiveThread(threadId, archived) {
  updateThread(threadId, {archived: !archived}).then(() => {
    if (archived) {
      showAlert('Conversation has moved to inbox.', 'alert-primary')
    } else {
      showAlert('Conversation has moved to archive.', 'alert-info')
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

    const invalid = email.split(',').map(address => address.trim()).find(address => !validateEmail(address));
    if (invalid !== undefined) {
      bootbox.alert(`The address "${escapeHtml(invalid)}" in the <b>To</b> field was not recognized`);
      return;
    }

    const form = new FormData();
    form.append('recipients', document.querySelector('#compose-recipients').value);
    form.append('subject', document.querySelector('#compose-subject').value);
    form.append('body', document.querySelector('#compose-body').innerHTML);
    form.append('thread_id', replyThreadId);
    composeFiles.forEach(file => form.append('attachments', file));

    fetch('/emails', {
      method: 'POST',
      body: form
    })
    .then(response => response.json())
    .then(result => {
      console.log(result)
      if (result.status == 201) {
        showAlert('Your message has been successfully sent.', 'alert-success')
        clearAttachments();
        replyThreadId = '';
        load_mailbox("sent");
      } else {
        showAlert(result.error || 'Failed to send message!.', 'alert-danger')
      }
    })
    .catch(() => showAlert('Failed to send message!.', 'alert-danger'))
  }

  function validateEmail(email) {
    const reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return reg.test(String(email).toLowerCase());
  }

  function sendReply(thread) {
    // Show compose view and hide other views
    document.querySelector('#emails-view').style.display = 'none';
    document.querySelector('#compose-view').style.display = 'block';
    document.querySelector('.title-header').innerHTML = "Reply Email"

    // Reply to whoever sent the latest message; if that was me, to the same people again
    const email = thread.emails[thread.emails.length - 1];
    const to = email.sender === currentUser() ? email.recipients.join(', ') : email.sender;
    document.querySelector('#compose-recipients').value = to;
    document.querySelector('#compose-subject').value = `Re: ${thread.subject}`;

    clearAttachments();
    replyThreadId = thread.thread_id;

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
