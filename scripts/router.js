class Router {
  constructor(nameweb, config){
    this.nameweb = nameweb;
    this.error_404 = config.error_404;
    this.routes = [];
    this.sesions = config.sesions_name ? config.sesions_name : "website-sesions";
    this.app = config.app;
  }
  get(route, func){
    let setArray = Array.isArray(route);
    if(setArray == true){
      route.forEach((element, i) => {
        this.routes.push({route: element, func: func});
      })
    }else {
      this.routes.push({route: route, func: func});
    }
  }
  start(){
    if(!this.app) return console.log(new Error('App is not defined'));
    var newHash = window.location.hash; 
    let titleChanged = document.querySelector('title').innerHTML = `${this.nameweb ? this.nameweb : "WebSite"} | ${newHash != '' ? newHash.slice(2).toUpperCase() : "Home"}`;
    let suroute = newHash.slice(1) ? newHash.slice(1) : "";

    let sesions = document.querySelector(`${this.app}`);
    
    let finding = this.routes.find(ch => ch.route == suroute);
    if(!finding){
      sesions.innerHTML = `
        ${this.error_404?this.error_404:"<div>Pagina No Encontrada</div>"}
      `;
    }else {
      sesions.innerHTML = `${finding.func({route: suroute, finder: finding})}`;
    }
  }
  listen(){
    window.addEventListener("hashchange", () => {
      this.start()
    });
  }
  go(route){
    location.location.hash = `/${route}`;
  }
}