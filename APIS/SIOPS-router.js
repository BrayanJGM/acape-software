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

  async start(){
    if(!this.app) return console.log(new Error('App is not defined'));
    
    const newHash = window.location.hash;
    const suroute = newHash.slice(1) || "";
    const sesions = document.querySelector(`${this.app}`);

    let matchedRoute = null;
    let params = {};

    for (let r of this.routes) {
      const routeParts = r.route.split('/');
      const urlParts = suroute.split('/');

      if (routeParts.length !== urlParts.length) continue;

      let isMatch = true;
      let tempParams = {};

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(":")) {
          const key = routeParts[i].slice(1);
          tempParams[key] = urlParts[i];
        } else if (routeParts[i] !== urlParts[i]) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        matchedRoute = r;
        params = tempParams;
        break;
      }
    }

    if (!matchedRoute) {
      sesions.innerHTML = this.error_404 || "<div>Página no encontrada</div>";
    } else {
      document.title = `${this.nameweb || "WebSite"} | ${suroute.toUpperCase()}`;
      const content = await matchedRoute.func({ route: suroute, params });
      sesions.innerHTML = content;
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

