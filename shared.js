/* Default match state. The control panel sends patches that get merged into this.
   AGENTS/WEAPONS lists are used to populate the control panel dropdowns. */

const AGENTS = ["Jett","Raze","Phoenix","Yoru","Neon","Reyna","ISO","Waylay",
  "Sova","Breach","Skye","KAY/O","Fade","Gekko","Tejo",
  "Sage","Cypher","Killjoy","Chamber","Deadlock","Vyse",
  "Brimstone","Omen","Viper","Astra","Harbor","Clove"];

const WEAPONS = ["Classic","Shorty","Frenzy","Ghost","Sheriff","Stinger","Spectre",
  "Bucky","Judge","Bulldog","Guardian","Phantom","Vandal",
  "Marshal","Outlaw","Operator","Ares","Odin","Knife"];

const MAPS = ["Ascent","Bind","Haven","Split","Icebox","Breeze","Fracture",
  "Pearl","Lotus","Sunset","Abyss","Corrode"];

function blankPlayer(i){
  return {
    name:"PLAYER"+i, agent:"Jett", alive:true, hp:100, shield:2,
    credits:3900, weapon:"Vandal",
    ultCur:0, ultMax:7, abilities:{c:true,q:true,e:true}, camOn:false
  };
}

const DEFAULT_STATE = {
  match:{
    map:"Ascent", round:1, phase:"BUY", timer:30,
    attackingSide:"A", spike:false, bestOf:3
  },
  teams:{
    A:{ name:"Team Alpha", tricode:"ALP", color:"#ff4655", score:0, logo:"", mapsWon:0 },
    B:{ name:"Team Bravo", tricode:"BRV", color:"#18e0c4", score:0, logo:"", mapsWon:0 }
  },
  players:{
    A:[1,2,3,4,5].map(blankPlayer),
    B:[6,7,8,9,10].map(blankPlayer)
  },
  cam:{ on:false, team:"A", label:"CASTER CAM" },
  ui:{ showRails:true }
};

// maps a team needs to win the series (Bo1->1, Bo3->2, Bo5->3)
function mapsToWin(bestOf){ return Math.ceil((bestOf||1)/2); }

if (typeof module !== "undefined") module.exports = { DEFAULT_STATE, AGENTS, WEAPONS, MAPS, blankPlayer, mapsToWin };
