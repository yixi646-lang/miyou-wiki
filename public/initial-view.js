(() => {
  if(new URLSearchParams(location.search).size!==0)return;
  document.documentElement.dataset.screen='home';
  document.documentElement.dataset.sidebar='hidden';
})();
