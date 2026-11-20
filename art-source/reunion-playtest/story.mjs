// Reunion branch. All dialogue below is a fictional first draft for owner review.
// Voice informed by a bounded sample of the five owner-requested Messages threads.
// No raw messages, contact details, or private factual anecdotes are included.
const L=(speaker,text)=>({speaker,text});
const N=text=>L('Scene',text);
const C=(id,label,to)=>({id,label,to});
// extra.artDesc: optional artwork description for this panel (owner's to write; the page shows
// an editable placeholder until it is set).
const node=(title,beats,extra={})=>({title,beats,...extra});
export const version='2026-11-20-reunion-3';
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
 {id:'opening',title:'The notification',sub:'One delivery. Twenty-five years.',start:'doorstep',nodes:{
 // Owner edits 2026-11-14 (exported from /dialogue2): Andrew texts, lunch at Spud on Alki (owner 2026-11-20; was Toshi's), the Pullman venue mix-up.
 doorstep:node('Leave at door',[N("Alki Beach, Seattle. Brendan is finishing a food delivery. His guitar is in the car. The delivery app has an opinion about how long this should take. And he gets a text from his friend..."),L('Andrew (3BC)',"Yo! I'm swinging through Seattle. Let's meet for lunch so I can get you your wallet back."),L('Brendan',"Just finishing up here at the office, Spud on Alki? I could go for a basket.")],{art:'brendan',artDesc:"Brendan is looking at his phone, delivering a bag of food that he carelessly sets on the edge of the porch, where it visibly starts to fall off.",next:'toshis'}),
 toshis:node("Spud on Alki",[L('Andrew (3BC)',"Not sure if you saw yet, but I just posted the High School Reunion info."),L('Brendan',"No, not online too much. I know it's next weekend, but anything noteworthy?"),L('Andrew (3BC)',"Yeah, don’t spread this, but I had AI book the venue, and after mentioning our Cougar mascot, it assumed we're WSU alumni and... well, we'll all be meeting up in Pullman.")],{art:'andrew',artDesc:"Andrew and Brendan are at Spud Fish & Chips on Alki, chatting over baskets of fish and chips.",choices:[C('blunder',"That's a pretty epic blunder. Can they remove you as ASB President 25 years after the party?",'notRemoved'),C('tour',"That's uhh.. Sure. Sealed lips. I was actually planning to tour this week anyway so, it works out.",'noBand')]}),
 notRemoved:node('Still president',[L('Andrew',"Ha. No one wants to be ASB President *after* high school.")],{art:'andrew',end:'Scene ends.',nextChapter:'crew'}),
 noBand:node('No band yet',[L('Andrew',"Perfect! You should bring your guitar. Also don’t mention: I haven't locked down a band yet...")],{art:'andrew',artDesc:"Close up of Andrew in a smaller panel. His face expresses that he is hiding something. Maybe this is two smaller panels that show the change in his expression — excited to potentially have found his entertainment, but scared that others will find out how last minute he was.",next:'sarah'}),
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
 // Owner edits 2026-11-20 (crew export).
 chat:node('The group chat',[N('Brendan shares the reunion poster with his friends.'),L("Andrew","Brendan said he was going to strum up some memories next weekend! You boys better be there."),L("Brendan","I don’t recall committing to anything. I’m still rusty."),L("Dan","Forget rust. Your skills have corroded by now."),L("Aaron","Oh boy, this is actually worth flying “home” for."),L("Jay","Please tell me you’ll finally pay someone for a haircut.")],{art:'dan',artDesc:"Player’s phone will be in player’s hand while text bubbles pop up one by one. Maybe smaller text bubble images need to be made to lay over main image.",choices:[C('headliner','I’m choosing to read this as support.','support'),C('equipment',"We’ll see how the next week plays out.",'equipment'),C('panic',"Again, I haven’t agreed. This chat got me leaning “no.”",'panic')]}),
 support:node('A generous interpretation',[L("Dan","Sure. Don’t get used to it."),L('Andrew','Seriously. Ask about the equipment.'),L("Jay","Update your profile photo. You look like you sell skateboards.")],{art:'andrew',artDesc:"(…continued) Player’s phone will be in player’s hand while text bubbles pop up one by one. Maybe smaller text bubble images need to be made to lay over main image.",next:'help'}),
 equipment:node('Load-in',[L('Andrew','Good. Bring the guitar.'),L('Dan','Leave a few opinions at home. Save on gas.'),L('Jay','I’ll help with the photo. Daylight. Decent shirt. No bathroom mirror.')],{art:'jay',next:'help'}),
 panic:node('The comfortable option',[L('Dan','Good. We were worried you’d actually have to rehearse.'),L('Andrew','Say yes if you want to play. We’ll figure out the rest.'),L('Jay','There. Emotional support. Screenshot it.')],{art:'andrew',next:'help'}),
 help:node('A separate message',[L('Yusen','You’re driving all that way? Stop somewhere. Do something.'),L('Brendan','I’m trying to look like I do things.'),L('Yusen','Doing one might help.'),L('Yusen','Bring shoes you can walk in.')],{art:'yusen',end:'He has people in his corner. Some of them are making it difficult to hide.',nextChapter:'mom'})
 }},
 {id:'mom',title:'Mom calls',sub:'The person who already likes him.',start:'call',nodes:{
 // Owner edits 2026-11-20 (Mom export). Her windshield offer and Brendan's answer end the scene;
 // the earlier draft's follow-up panels (photo of the crack, Dad and the poster) were dropped.
 call:node('Incoming: Mom',[L("Mom","I heard you might play at your reunion. Is it going to be at McMiniman’s? That would be fun."),L("Brendan","How did you…? No for contract obligations I won’t get into it but it’s in Spokane."),L("Mom","Oh gosh! That’s a drive. Will you please get your windshield fixed before you leave?? I’ll pay for it.")],{art:'brendan',artDesc:"Text message with friends artwork ends with a pop up call from Mom. That next panel will be driver, taking the Seattle exit while talking to his mom, on speakerphone. Phone is on the dash, just like the menu image. A second panel will show mom at a location that is ironic for a mom to be, talking on the phone, with Brendan’s [player’s] text bubbles coming through the phone.",choices:[C('worry',"I will, you worry wart. Thank you. (+3)",'driveSafe'),C('fine',"It’s fine, mom! I don’t even notice it anymore. (-3)",'offered')]}),
 driveSafe:node('Drive safe',[L("Mom","And drive safe!")],{art:'brendan',end:'Scene ends.',nextChapter:'detour'}),
 offered:node('Just thought I’d offer',[L("Mom","Okay, honey. Just thought I’d offer")],{art:'brendan',end:'Scene ends.',nextChapter:'detour'})
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
