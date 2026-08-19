document.addEventListener('DOMContentLoaded',function(){
(function(){try{
  if(localStorage.getItem('weyn_ck')==='1')return;
  var b=document.getElementById('ckbar');b.classList.add('on');
  document.getElementById('ckok').addEventListener('click',function(){
    b.classList.remove('on');try{localStorage.setItem('weyn_ck','1')}catch(e){}
  });
}catch(e){}})();
});
