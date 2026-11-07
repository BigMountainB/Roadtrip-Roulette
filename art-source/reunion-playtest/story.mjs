// Reunion branch. All dialogue below is a fictional first draft for owner review.
// Voice informed by a bounded sample of the five owner-requested Messages threads.
// No raw messages, contact details, or private factual anecdotes are included.
const L=(speaker,text)=>({speaker,text});
const N=text=>L('Scene',text);
const C=(id,label,to)=>({id,label,to});
const node=(title,beats,extra={})=>({title,beats,...extra});
export const version='2026-11-06-reunion-1';
export const cast=[
 {id:'brendan',name:'Brendan',role:'The driver',note:'A musician with a delivery route and a very selectively worded life update.'},
 {id:'sarah',name:'Sarah',role:'An old crush',note:'An encouraging message can be much more dangerous than an insult. Her role is still open.'},
 {id:'shelby',name:'Shelby',role:'An old crush',note:'A familiar face at the reunion. Her personality and relationship route are still to be written.'},
 {id:'katie',name:'Katie',role:'An old crush',note:'Another connection from school. Her role and reunion scenes are still to be written.'},
 {id:'andrew',name:'Andrew',role:'The friend who asks the useful question',note:'Practical, direct, helpful. Lets Brendan take an absurd thought much further than necessary.'},
 {id:'dan',name:'Dan',role:'The short reply',note:'Dry observations, quick teasing, and very little ceremony.'},
 {id:'jay',name:'Jay',role:'The friend with presentation standards',note:'Easy banter and enthusiasm. Fashionable activewear; outfits can change by scene.'},
 {id:'yusen',name:'Yusen',role:'The former college roommate',note:'Playful, curious, and actually willing to make plans. His detour may turn into an afternoon.'}
];
export const chapters=[
 {id:'opening',title:'The notification',sub:'One delivery. Twenty years.',start:'doorstep',nodes:{
 doorstep:node('Leave at door',[N('Seattle. Brendan is finishing a food delivery. His guitar is in the car. The delivery app has an opinion about how long this should take.'),L('Delivery instructions','Please don’t ring. Dog thinks he owns the house.'),L('Reunion group','Twenty years! Who’s coming back to Spokane?')],{art:'brendan',next:'sarah'}),
 sarah:node('A familiar name',[L('Sarah','Brendan! Are you still doing music?'),N('He looks at the food bag. Then back at her name.')],{art:'sarah',choices:[C('road','Yeah. On the road constantly.','touring'),C('commercial','Mostly commercial work. Very exclusive audience.','commercial'),C('honest','A little. The jingle finally pays royalties.','honest')]}),
 touring:node('Selective accuracy',[L('Sarah','I knew you’d make it.'),N('For a moment he stands a little straighter.')],{art:'brendan',next:'booking'}),
 commercial:node('The audience',[L('Sarah','Wait, you’re doing this professionally?'),L('Brendan','People have paid. I’m comfortable ending the sentence there.')],{art:'brendan',next:'booking'}),
 honest:node('An actual achievement',[L('Sarah','You got something picked up? That’s brilliant.'),L('Brendan','Twelve seconds. I’m trying not to let it change me.')],{art:'brendan',next:'booking'}),
 booking:node('An opening appears',[L('Organizer','We still need someone to play on Saturday.'),L('Sarah','You should do it!')],{art:'sarah',choices:[C('yes','I could put something together.','poster'),C('dj','What happened to the DJ?','dj'),C('number','How many people are we talking?','number')]}),
 dj:node('The entertainment budget',[L('Organizer','He backed out. Apparently we bullied him.'),L('Sarah','We were awful to everybody.'),L('Organizer','Yes, but he has equipment now.')],{art:'sarah',next:'poster'}),
 number:node('An unhelpful estimate',[L('Organizer','Depends how many people’s second marriages survive until Saturday.'),L('Brendan','Could you express that in chairs?')],{art:'brendan',next:'poster'}),
 poster:node('Pending confirmation',[N('A new preview appears in the group: LIVE SATURDAY — BRENDAN. The photo is old enough to need its own reunion.'),L('Organizer','Just a mockup. Tell me if you’re in.'),N('He saves the image before answering.')],{art:'brendan',end:'A booking is possible. So is pretending he never saw this.',nextChapter:'crew'})
 }},
 {id:'crew',title:'The crew',sub:'Support, technically.',start:'chat',nodes:{
 chat:node('The group chat',[N('Brendan shares the reunion poster with his friends.'),L('Brendan','Might be performing at the reunion.'),L('Dan','As what?'),L('Andrew','Do they have sound equipment?'),L('Jay','Please tell me that isn’t your current haircut.')],{art:'dan',choices:[C('headliner','I’m choosing to read this as support.','support'),C('equipment','I own a guitar and several opinions.','equipment'),C('panic','I haven’t said yes yet.','panic')]}),
 support:node('A generous interpretation',[L('Dan','Correct. Don’t get used to it.'),L('Andrew','Seriously. Ask about the equipment.'),L('Jay','And get a new photo. You look like you’re about to sell me a skateboard.')],{art:'andrew',next:'help'}),
 equipment:node('Load-in',[L('Andrew','Good. Bring the guitar.'),L('Dan','Leave a few opinions at home. Save on gas.'),L('Jay','I’ll help with the photo. Daylight. Decent shirt. No bathroom mirror.')],{art:'jay',next:'help'}),
 panic:node('The comfortable option',[L('Dan','Good. We were worried you’d actually have to rehearse.'),L('Andrew','Say yes if you want to play. We’ll figure out the rest.'),L('Jay','There. Emotional support. Screenshot it.')],{art:'andrew',next:'help'}),
 help:node('A separate message',[L('Yusen','You’re driving all that way? Stop somewhere. Do something.'),L('Brendan','I’m trying to look like I do things.'),L('Yusen','Doing one might help.'),L('Yusen','Bring shoes you can walk in.')],{art:'yusen',end:'He has people in his corner. Some of them are making it difficult to hide.',nextChapter:'mom'})
 }},
 {id:'mom',title:'Mom calls',sub:'The person who already likes him.',start:'call',nodes:{
 call:node('Incoming: Mom',[L('Mom','Are you coming home for your reunion?'),L('Brendan','How does everybody know before I do?'),L('Mom','You put a poster on the internet.'),L('Brendan','It’s a mockup.'),L('Mom','You look happy.')],{art:'brendan',next:'glass'}),
 glass:node('A crack in the presentation',[L('Mom','Also, send me a picture of your windshield.'),L('Brendan','Why?'),L('Mom','You posted a sunset with a crack through it.')],{art:'brendan',choices:[C('send','Okay. I’ll send it before I leave.','send'),C('dad','Has Dad seen the poster?','dad'),C('art','That was an artistic choice.','art')]}),
 send:node('An achievable request',[L('Mom','Thank you. Get me a quote. I can help with that.'),L('Brendan','You don’t have to.'),L('Mom','I know. Text me back occasionally and we’ll both try something new.')],{art:'brendan',next:'leave'}),
 dad:node('A familiar audience',[L('Mom','I sent it to him.'),L('Brendan','What did he say?'),L('Mom','He asked what time.'),L('Brendan','That’s it?'),L('Mom','What would you like me to add?')],{art:'brendan',next:'leave'}),
 art:node('Mixed reviews',[L('Mom','It’s going to become a ventilation choice. Get me a quote.'),L('Brendan','Fine. Before I leave.'),L('Mom','Good. Now you’ve got an opening act.')],{art:'brendan',next:'leave'}),
 leave:node('Before departure',[N('He has a possible set on Saturday, an old photo to replace, and a message from his mother he could answer right now.'),L('Brendan','One decent picture. Then I’ll deal with the rest.')],{art:'brendan',end:'The next stop can start as an excuse and become something else.',nextChapter:'detour'})
 }},
 {id:'detour',title:'The first detour',sub:'A photo becomes a plan.',start:'fork',nodes:{
 fork:node('Take the scenic route',[N('Brendan checks two saved photo spots. One promises a quick stop. The other involves walking.'),L('Yusen','Quick photo or an actual walk?')],{art:'yusen',choices:[C('quick','Quick photo. I’m rebuilding my life on a schedule.','quick'),C('walk','Fine. Actual walk. If I die, use the good photo.','walk')]}),
 quick:node('The recognizable spot',[L('Yusen','You’ve taken eleven. Which one looks spontaneous?'),L('Brendan','The one where you’re not asking that.'),N('Someone waiting for a turn spots the guitar case in Brendan’s car.'),L('Stranger','Do you play? We’ve got an open-mic slot tonight.')],{art:'yusen',next:'offer'}),
 walk:node('Out of frame',[N('Partway along the trail, Brendan finds a view he hasn’t seen through his phone. He puts it away for a minute.'),L('Yusen','See?'),L('Brendan','I’m enjoying something. Don’t supervise it.'),N('At the trailhead, they start talking with someone heading to an open mic that evening.')],{art:'yusen',next:'offer'}),
 offer:node('A small opportunity',[L('Stranger','One song. Nothing fancy.'),L('Brendan','That’s the name of my current tour.')],{art:'brendan',choices:[C('play','Put me down for one. I could use the rehearsal.','play'),C('ask','Can I come listen first?','listen'),C('photo','I really just came for a picture.','photo')]}),
 play:node('A real booking',[L('Yusen','Now you’re on the road doing music.'),L('Brendan','Don’t say it like that. It makes the sandwiches sound dishonest.')],{art:'brendan',end:'Next draft: the open mic. A small set can become a collaborator, a better booking, or a spectacular misunderstanding.'}),
 listen:node('An open door',[L('Stranger','Sure. Bring the guitar anyway.'),L('Yusen','Very subtle.'),L('Brendan','I respect a trap with parking.')],{art:'yusen',end:'Next draft: watching the open mic, with an opportunity to change his mind.'}),
 photo:node('Proof of attendance',[N('He has the picture he came for. The invitation is still on his phone.'),L('Yusen','Want another one?'),L('Brendan','No. I think I’ve documented enough personal growth for one morning.')],{art:'brendan',end:'Next draft: back on the road. Another opportunity can arrive through a different stop.'})
 }}
];
