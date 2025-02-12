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

  // By default, load the inbox
  load_mailbox('inbox');
});

function compose_email() {
  // Show compose view and hide other views
  document.querySelector('#emails-view').style.display = 'none';
  document.querySelector('#compose-view').style.display = 'block';

  // Clear out composition fields
  document.querySelector('.title-header').innerHTML = "New Email"
  document.querySelector('#compose-recipients').value = '';
  document.querySelector('#compose-subject').value = '';
  document.querySelector('#compose-body').value = '';

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
      if (email.body.length > length) {
        email_body = email.body.slice(0, length) + " ..."
      } else {
        email_body = email.body
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
                  ${email.body}
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
        body: document.querySelector('#compose-body').value
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

    document.querySelector('#compose-body').value = `\n\n ----- On ${email.timestamp}: <${email.sender}> wrote: \n\n${email.body}`;
    document.querySelector('#compose-body').focus();
    document.querySelector('#compose-body').setSelectionRange(0, 0); 

    // Add event listener to send email button
    document.querySelector('#compose-send').addEventListener('click', (response) => {
      bootbox.hideAll();
        sendEmail();
        response.preventDefault();
    })
  }