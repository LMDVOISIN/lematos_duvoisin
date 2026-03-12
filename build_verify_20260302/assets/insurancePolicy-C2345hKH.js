const e=n=>{const t=Number(n);return Number.isFinite(t)?Math.max(0,t):0},r=n=>Math.round(e(n)*100)/100,A=({rentalAmount:n=0,rentalDays:t=0,selected:u=!1,explicitAmount:m=null}={})=>{if(!u)return 0;const o=e(m);if(o>0)return r(o);const a=e(n),c=Math.max(0,Number(t)||0),s=a*.08,N=c*2;return r(Math.max(s,N))};export{A as c};
//# sourceMappingURL=insurancePolicy-C2345hKH.js.map
