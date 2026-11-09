function chooseSide(current,pref,ok){return current!=null&&ok(current)?current:ok(pref)?pref:ok(-pref)?-pref:pref}export{chooseSide};
