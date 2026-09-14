class alerter {
  constructor(father){
    this.overlay = null;
    this.popup = null;
    this.father = father;
  }
  open(pop = {title: String, content: String}){
    this.start()
    this.overlay.classList.add('active');
    this.popup.classList.add('active');
    document.querySelector('.title-popup').innerHTML = pop.title?pop.title:"";
    document.querySelector('.content-popup').innerHTML = pop.content?pop.content:"";
    document.querySelector('.closePopup').addEventListener('click', (e) => {
      if(pop.closeButtonFunction){
        pop.closeButtonFunction();
      }else {
        this.close()
      }
    })
    if(pop.close == false) document.querySelector('.closePopup').innerHTML = "";
  }
  close(){
    this.start();
    /*this.popup.classList.add('animate');
    setTimeout(function() {
      this.popup.classList.remove('active');
      this.overlay.classList.remove('active');
      this.popup.classList.remove('animate');
    }, 400);*/
  }
  start(){
    document.querySelector(this.father?this.father:".alerter").innerHTML = `<div class="overlay">
      <div class="popup">
        <div class="controls-popup">
          <h3 class="title-popup"></h3>
          <span class="closePopup">×</span>
        </div>
        <div class="content-popup"></div>
        <br>
        <div class="notification-popup"></div>
      </div>
    </div>`;
    this.overlay = document.querySelector('.overlay');
    this.popup = document.querySelector('.popup');
  }
  setNotification(text){
    document.querySelector('.notification-popup').innerHTML = `<div class="setting-noti">${text}</div>`;
  }
}
