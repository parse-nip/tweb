import type {RizzScenario} from '@components/rizz/content/types';

/*
 * The opening book. Six conversations, six turns each; every puzzle is cut out of these too
 * (`engine.ts` → `buildPuzzles`), so a new scenario is new games and new puzzles at once.
 *
 * Writing rules: the three `them` variants of a turn say the same thing in three moods, so all of
 * the turn's options answer each of them. Scores: best +120…+180, decent +40…+90, dubious -60…-160,
 * a blunder -250 and below.
 */
const SCENARIOS: RizzScenario[] = [{
  id: 'travel-bio',
  title: 'The travel bio',
  setting: 'You matched on a dating app. Their bio: "Just got back from Lisbon. Looking for someone to split a pastel de nata with."',
  turns: [{
    options: [
      {text: 'Lisbon! Be honest: how many pastéis de nata did you actually eat?', score: 150, book: true, why: 'Opening theory: it answers the bio\'s own hook with a playful question that is easy to reply to.'},
      {text: 'Hey, how are you?', score: -60, why: 'The "hey" opener. Legal, but it gives them nothing to play with — you spent a move doing nothing.'},
      {text: 'I\'ll split one with you, but I\'m taking the bigger half.', score: 180, brilliant: true, why: 'Brilliant: it accepts the bio\'s invitation, adds a tease and already pictures you two together. Bold, and it works.'},
      {text: 'You\'re really beautiful.', score: -180, why: 'A compliment on looks as the first move tells them you skipped the bio. Generic and a little heavy.'}
    ]
  }, {
    them: [
      'Hahaha okay you got me. Four. In one day. No regrets 😌 have you been?',
      'Haha a few 😅 have you been?',
      'Uh, fine I guess. Have you been to Lisbon?'
    ],
    options: [
      {text: 'Not yet — but four in one day means you\'re officially my tour guide.', score: 140, why: 'Turns their answer into a future plan with you in it, without asking for anything yet.'},
      {text: 'No. I don\'t really like traveling.', score: -150, why: 'A conversation-ender on the one topic they chose. Honest, maybe, but it closes the position.'},
      {text: 'Yeah I went in 2019, it was nice.', score: 30, why: 'Fine, but flat: "it was nice" gives them no hook to reply to.'},
      {text: 'Once! I got lost in Alfama for three hours and somehow ended up at a fado bar. Best mistake ever.', score: 120, why: 'A short, vivid story invites them to trade stories back. Good development.'}
    ]
  }, {
    them: [
      'Ooh okay a tour guide, I like that. I charge in pastries though. What about you, where\'s your happy place?',
      'Haha nice. So what do you do when you\'re not traveling?',
      'Okay. So what do you do?'
    ],
    opening: true,
    options: [
      {text: 'I\'m an accountant.', score: -40, why: 'Answers the question and nothing more. They opened a door; you stood in it.'},
      {text: 'Weekdays I build software, weekends I\'m on a mission to find the city\'s best bakery. You\'d be a useful consultant.', score: 150, why: 'Answers, keeps the pastry callback alive and slips in a reason to meet. Best move.'},
      {text: 'Wanna come over and find out? 😏', score: -320, why: 'Blunder: escalating to "come over" this early reads as pushy and sinks the whole position.'},
      {text: 'Mostly cooking. I make a mean carbonara.', score: 70, why: 'Shares something real and tasty. Good, though it leaves the next move to them.'}
    ]
  }, {
    them: [
      'Okay a bakery mission is the cutest thing I\'ve heard all week 😂 found any good ones?',
      'Haha that\'s fun. Any good ones so far?',
      'Hm, okay. Any good ones?'
    ],
    options: [
      {text: 'One. It\'s a tiny place on 5th with a cardamom bun that could end wars. I\'m not telling you where though.', score: 120, why: 'Playful withholding creates tension — they now want the answer.'},
      {text: 'Not really, they\'re all the same.', score: -110, why: 'You undercut your own story. If it was a mission, why is it boring?'},
      {text: 'Yes. I keep a ranked spreadsheet. I\'m not joking.', score: 90, why: 'Self-aware and a little weird in a charming way. Solid.'},
      {text: 'Why do you care lol', score: -280, why: 'Blunder: answers interest with defensiveness. A clean way to lose the game.'}
    ]
  }, {
    them: [
      'Okay now you HAVE to tell me 😤 I\'m a professional bun critic',
      'Haha now I\'m curious',
      'Lol ok'
    ],
    opening: true,
    options: [
      {text: 'Some secrets must be earned. Saturday morning, I\'ll take you there and you can rate it yourself.', score: 170, brilliant: true, why: 'Brilliant: the reveal becomes the date. Their curiosity is the reason to say yes.'},
      {text: 'I\'ll send you the address.', score: 0, why: 'Helpful — and it gives away the one thing that made meeting you worthwhile.'},
      {text: 'We should hang out sometime maybe?', score: 40, why: 'A plan in the right direction, but "sometime maybe" is so soft it is easy to wave away.'},
      {text: 'Only if you send a pic first 😉', score: -400, why: 'Blunder. Conditions plus a photo request — this is how people get unmatched.'}
    ]
  }, {
    them: [
      'Saturday works 😊 but if this bun isn\'t life-changing you\'re buying round two',
      'Haha maybe! What time were you thinking?',
      'Hm, I don\'t know you very well yet'
    ],
    options: [
      {text: 'Deal. 10am, and I\'ll bring the spreadsheet for peer review.', score: 150, why: 'Confirms a concrete time and closes with a callback. That is the checkmate pattern.'},
      {text: 'Fair — let\'s do a quick coffee first, no pressure. Bun optional.', score: 110, why: 'Reads their comfort and lowers the stakes. Calm, confident, kind.'},
      {text: 'Whatever, your loss.', score: -450, why: 'Blunder: punishes hesitation. It confirms their doubts in four words.'},
      {text: 'Ok cool', score: -30, why: 'You had a winning position and played a waiting move. No time, no place, no plan.'}
    ]
  }],
  endings: {
    win: 'Saturday, 10am. It\'s a date 🥐💘',
    draw: 'Haha you seem really nice! Let\'s keep chatting 🙂',
    loss: 'Sorry, I don\'t think we\'re a match. Good luck though!'
  }
}, {
  id: 'story-reply',
  title: 'The story reply',
  setting: 'They posted a story: a slightly burnt homemade pizza, captioned "chef\'s kiss?". You decide to reply.',
  turns: [{
    options: [
      {text: 'The crust says "chef\'s kiss". The edges say "chef\'s smoke alarm".', score: 160, book: true, why: 'Opening theory for story replies: tease the exact thing they posted, lightly.'},
      {text: 'Wow 😍', score: -20, why: 'Story-reply autopilot. Polite, forgettable, easy to leave on seen.'},
      {text: 'Rate it out of 10? I\'m giving it a 7, a strong 7.', score: 110, why: 'A question with a playful opinion attached. Good opener.'},
      {text: 'You can\'t cook lol', score: -230, why: 'Teasing with no warmth is just criticism. Bad start.'}
    ]
  }, {
    them: [
      'HEY 😂 the smoke alarm only went off once. That\'s a personal best',
      'Haha it\'s my first try ok',
      'It tasted fine.'
    ],
    options: [
      {text: 'Once is basically a Michelin star. What was on it?', score: 120, why: 'Supports their joke, then asks a question that keeps them talking.'},
      {text: 'You should try my pizza, it\'s way better.', score: -90, why: 'Steering every topic to yourself. Competitive, not flirty.'},
      {text: 'Respect for trying. My first pizza looked like a crime scene.', score: 100, why: 'Self-deprecation makes them feel safe. A good, human move.'},
      {text: 'Cool', score: -150, why: 'They gave you something; you gave them nothing back.'}
    ]
  }, {
    them: [
      'Mushrooms, chili honey and way too much cheese. Do you cook?',
      'Mushrooms and cheese. Do you cook?',
      'Just mushrooms. Do you cook?'
    ],
    opening: true,
    options: [
      {text: 'Chili honey?? Okay, you\'re officially more interesting than me. I can do one dish well and I won\'t tell you which.', score: 140, why: 'Genuine enthusiasm plus a small mystery. They will ask which dish.'},
      {text: 'Yes.', score: -80, why: 'One word to a direct question they asked to keep things going.'},
      {text: 'We should have a cook-off. Loser does the dishes.', score: 170, brilliant: true, why: 'Brilliant: a playful challenge that is secretly an invitation. Hard to say no to.'},
      {text: 'I mostly order in tbh', score: 20, why: 'Honest, slightly flat. Not a mistake, not an idea either.'}
    ]
  }, {
    them: [
      'Oh it\'s ON. But I\'m warning you, I\'m competitive',
      'Haha maybe. What\'s your best dish?',
      'Haha ok'
    ],
    options: [
      {text: 'Good. I\'d hate to win easily. My weapon of choice is a ridiculous lasagna.', score: 130, why: 'Matches their energy and names your move. Confident.'},
      {text: 'Ok', score: -120, why: 'Their energy went up, yours went down. That gap is felt.'},
      {text: 'Honestly I\'m not that good, sorry', score: -60, why: 'Backing out of your own game. A small loss of confidence.'},
      {text: 'Lasagna. Layered, like my personality.', score: 90, why: 'A cheesy line, knowingly. It works when delivered like this.'}
    ]
  }, {
    them: [
      'Lasagna vs my pizza. I\'m already planning my victory speech',
      'Lasagna is a strong pick ngl',
      'Lasagna is ok'
    ],
    opening: true,
    options: [
      {text: 'Then let\'s make it official: Sunday, my place or yours, a neutral judge — my roommate.', score: 110, why: 'Moves the joke into a real plan. Slightly fast with "my place", but it fits the game you built.'},
      {text: 'Next weekend? We pick a kitchen, you bring the chili honey.', score: 150, why: 'Specific, light, and leaves the choice of kitchen open. Best.'},
      {text: 'Haha yeah', score: -70, why: 'Missed the obvious move to turn this into a plan.'},
      {text: 'Bet you can\'t beat me at anything lol', score: -200, why: 'Escalates the competition instead of the connection.'}
    ]
  }, {
    them: [
      'Deal 😌 prepare to lose',
      'Haha sure, why not',
      'I\'ll think about it'
    ],
    options: [
      {text: 'I\'ll bring a fire extinguisher, just for you. Saturday or Sunday?', score: 150, why: 'A callback to the opener and a two-option close. Textbook finish.'},
      {text: 'Take your time. The lasagna invitation doesn\'t expire.', score: 90, why: 'Patient and warm. Leaves room without letting the plan die.'},
      {text: 'Why are you being so difficult', score: -380, why: 'Blunder: turns a light game into pressure.'},
      {text: 'Cool', score: -40, why: 'A waiting move at the moment to close.'}
    ]
  }],
  endings: {
    win: 'Sunday. Bring your apron 🍕🔥',
    draw: 'Haha you\'re funny. Maybe some day!',
    loss: 'Seen ✓✓'
  }
}, {
  id: 'gym',
  title: 'The gym DM',
  setting: 'You\'ve nodded at each other at the gym for weeks. Today they followed you back. Your move.',
  turns: [{
    options: [
      {text: 'So are we finally going to acknowledge we both skip leg day on Fridays?', score: 160, book: true, why: 'Opening theory: a shared, specific observation. It shows you noticed without being creepy.'},
      {text: 'Hi', score: -60, why: 'Technically a move.'},
      {text: 'I\'ve been watching you at the gym for weeks', score: -350, why: 'Blunder: true, and the worst possible way to say it.'},
      {text: 'Hey! Nice to finally meet beyond the nod 👋', score: 90, why: 'Warm and acknowledges the history. Good, if safe.'}
    ]
  }, {
    them: [
      'HAHA oh no you noticed. Fridays are for upper body and denial',
      'Haha hey! Yeah finally',
      'Hi'
    ],
    options: [
      {text: 'Your secret\'s safe. What got you into lifting?', score: 110, why: 'Keeps the joke and opens a real topic.'},
      {text: 'What\'s your bench?', score: -40, why: 'Gym-bro small talk. Fine between lifts, flat in DMs.'},
      {text: 'Denial is a valid training split. I\'m on it too.', score: 130, why: 'Matches their humour exactly. Builds the inside joke.'},
      {text: 'You\'re way hotter than the others there', score: -220, why: 'A ranking of strangers is not a compliment.'}
    ]
  }, {
    them: [
      'Started after college, now it\'s my therapy. Also there\'s a smoothie place next door I\'m obsessed with',
      'Mostly to destress honestly. What about you?',
      'Just stress. You?'
    ],
    opening: true,
    options: [
      {text: 'Same — it\'s the one hour my phone is quiet. Which smoothie is the obsession?', score: 140, why: 'Shares something real, then grabs the detail they offered.'},
      {text: 'I want to get big lol', score: -30, why: 'Honest, but it ignores what they just shared.'},
      {text: 'The smoothie place by the entrance? I\'ve always wanted someone to tell me what to order there.', score: 160, brilliant: true, why: 'Brilliant: you made their obsession a reason to meet, without asking yet.'},
      {text: 'Smoothies are overpriced sugar', score: -170, why: 'Attacking the thing they love. Accurate, maybe; costly, definitely.'}
    ]
  }, {
    them: [
      'The mango-ginger. It\'s life changing. I could show you after a workout 👀',
      'The mango one. It\'s so good',
      'Mango.'
    ],
    opening: true,
    options: [
      {text: 'Friday after not-leg-day? I\'ll buy, you guide.', score: 170, why: 'Accepts the invite, specific time, inside joke. Best.'},
      {text: 'Cool, I\'ll try it sometime', score: -90, why: 'They practically offered; "sometime" refuses politely.'},
      {text: 'Is that a date? 😳', score: 60, why: 'Cute, but it puts the label pressure on them.'},
      {text: 'I\'m more of a protein shake guy', score: -120, why: 'Shuts the door on the plan they just opened.'}
    ]
  }, {
    them: [
      'It\'s a deal. Fair warning, I get chatty post-workout',
      'Haha sure, Friday works',
      'Maybe, we\'ll see'
    ],
    options: [
      {text: 'Perfect, I\'m great at nodding. I have weeks of practice.', score: 150, why: 'A callback to how you met. Charming close.'},
      {text: 'No pressure at all — if you\'re around Friday, say hi. If not, the nod continues.', score: 120, why: 'Respectful and confident. Great against hesitation.'},
      {text: 'Ok', score: -40, why: 'A waiting move.'},
      {text: 'Don\'t be weird about it', score: -300, why: 'Blunder: pressure dressed as a joke.'}
    ]
  }, {
    them: [
      'Lmaooo the nod. Okay. Friday 😊',
      'Haha see you Friday',
      'We\'ll see 🙂'
    ],
    options: [
      {text: 'See you Friday. I\'ll be the one pretending to stretch near the smoothie bar.', score: 140, why: 'Light confirmation that keeps the joke going. Clean finish.'},
      {text: 'Can I get your number too?', score: 60, why: 'Practical, a little abrupt after a perfect close.'},
      {text: 'Great!!!!! Can\'t wait!!!! 😍😍😍', score: -110, why: 'Over-investment showing. Calm is attractive.'},
      {text: 'K', score: -150, why: 'Ending on one letter undoes the game you played.'}
    ]
  }],
  endings: {
    win: 'Friday. Mango-ginger on you 🥭💪',
    draw: 'Haha see you around the gym!',
    loss: '*the nod stops*'
  }
}, {
  id: 'bookstore',
  title: 'The bookstore number',
  setting: 'You met in a bookstore arguing about a sci-fi novel. They wrote their number in your receipt. It\'s been a day.',
  turns: [{
    options: [
      {text: 'This is the person who\'s wrong about the ending of Dune. I\'ve prepared a rebuttal.', score: 170, book: true, why: 'Opening theory: re-open the argument you met in. Instant callback, instant identity.'},
      {text: 'Hi it\'s me from the bookstore', score: 40, why: 'Clear, if plain. At least they know who you are.'},
      {text: 'Hey', score: -100, why: 'They don\'t have your number. "Hey" from an unknown number is a puzzle, not a move.'},
      {text: 'Hi! I couldn\'t stop thinking about you all day', score: -150, why: 'Too much, too soon. Save intensity for later.'}
    ]
  }, {
    them: [
      'Oh it\'s YOU. Go on then, I\'m ready to destroy your argument',
      'Haha hi! I wondered if you\'d text',
      'Oh, hi.'
    ],
    options: [
      {text: 'Paul\'s not a hero, he\'s a warning. I rest my case.', score: 120, why: 'Picks up the debate with confidence and brevity.'},
      {text: 'Of course I texted, you were the best part of my day.', score: 50, why: 'Sweet, but a little early to say it outright.'},
      {text: 'Before the rebuttal — what are you reading now? I need to know who I\'m dealing with.', score: 140, why: 'Curiosity about them, framed as part of the game. Great.'},
      {text: 'Sorry for bothering you', score: -140, why: 'Apologizing for being wanted. They gave you their number!'}
    ]
  }, {
    them: [
      'A murder mystery set on a train. Very cozy, very dramatic',
      'A mystery novel, you?',
      'A mystery.'
    ],
    opening: true,
    options: [
      {text: 'Let me guess: the butler did it. No? The conductor. Final answer.', score: 110, why: 'Playful and engaged with what they\'re reading.'},
      {text: 'Mysteries are for people who can\'t handle real sci-fi', score: -200, why: 'Book snobbery. Lost a piece for a cheap joke.'},
      {text: 'Cozy and dramatic is exactly my reading speed. Let\'s trade books — mine is better, you\'ll see.', score: 160, brilliant: true, why: 'Brilliant: a swap means a second meeting, and the tease keeps the debate alive.'},
      {text: 'Cool. I\'m reading Foundation.', score: 20, why: 'An exchange of facts. Correct, colourless.'}
    ]
  }, {
    them: [
      'A book swap?? Okay that\'s actually adorable',
      'Haha maybe, what would you give me?',
      'Hmm, I\'m not sure'
    ],
    options: [
      {text: 'My most beat-up copy of Hyperion, with my angry notes in the margins. Very intimate.', score: 150, why: 'Specific, personal, funny. They get to know you through the swap.'},
      {text: 'Whatever you want', score: -50, why: 'No opinion. The swap only works if you have taste.'},
      {text: 'You don\'t have to, I just thought it\'d be fun', score: 30, why: 'Gentle, but it deflates your own idea.'},
      {text: 'Come over and pick from my shelf 😏', score: -260, why: 'Blunder: the wink turns a book into an invitation they didn\'t ask for.'}
    ]
  }, {
    them: [
      'Margin notes are basically a diary. I\'m in. Same bookstore Thursday?',
      'Haha ok, where would we swap?',
      'Maybe. Where?'
    ],
    opening: true,
    options: [
      {text: 'Thursday. Loser of the Dune debate buys the coffee.', score: 160, why: 'Confirms their plan and adds a stake. Best.'},
      {text: 'Same bookstore, the café upstairs. Thursday at 6?', score: 140, why: 'Specific and easy. Excellent.'},
      {text: 'Wherever, idk', score: -110, why: 'They asked you to lead. You didn\'t.'},
      {text: 'Can\'t this week, maybe next month', score: -200, why: 'You let the clock run out on your own plan.'}
    ]
  }, {
    them: [
      'Deal. Bring your rebuttal 📚',
      'Sounds good!',
      'Okay, maybe'
    ],
    options: [
      {text: 'It\'s 14 pages. Single-spaced. See you Thursday.', score: 140, why: 'A joke and a confirmation in one line.'},
      {text: 'No stress if you can\'t — but I really hope you do.', score: 110, why: 'Honest and warm. Great against a "maybe".'},
      {text: 'Ok', score: -40, why: 'A quiet finish to a loud game.'},
      {text: 'Don\'t stand me up lol', score: -150, why: 'Pre-emptive accusation. Makes it heavier.'}
    ]
  }],
  endings: {
    win: 'Thursday, 6pm. Bring Hyperion 📖💘',
    draw: 'Haha it was fun arguing with you!',
    loss: 'I think I\'ll keep my margins to myself. Take care!'
  }
}, {
  id: 'group-chat',
  title: 'The group chat crush',
  setting: 'You\'re both in a friend\'s group chat. They just sent a meme about hating mornings. Nobody replied. You DM them.',
  turns: [{
    options: [
      {text: 'Didn\'t want your meme to die alone in the group. Mornings are a scam.', score: 160, book: true, why: 'Opening theory for group chats: rescue the unanswered message. Kind and funny.'},
      {text: 'lol', score: -60, why: 'A reaction, not an opener. In a DM it\'s strange.'},
      {text: 'Why did no one reply to you? That\'s sad', score: -150, why: 'Pointing out the awkwardness makes it more awkward.'},
      {text: 'Hey! It\'s me from Maya\'s chat 👋 your memes are the only good part of it', score: 120, why: 'Friendly and a compliment on their humor. Good.'}
    ]
  }, {
    them: [
      'FINALLY someone appreciates my art. A true scholar',
      'Haha thanks! Mornings are the worst',
      'Haha thanks'
    ],
    options: [
      {text: 'I\'m a patron of the arts. What\'s your ideal morning then, if they\'re all scams?', score: 140, why: 'Keeps the bit and asks a revealing question.'},
      {text: 'Yeah lol', score: -100, why: 'You came in to rescue the conversation and then didn\'t.'},
      {text: 'I\'m a morning person actually', score: 30, why: 'Mild contrast. It can work, but you need to follow up.'},
      {text: 'You\'re cute, wanna get drinks?', score: -40, why: 'Skipping the middle game. Direct, and a bit sudden.'}
    ]
  }, {
    them: [
      'Noon. Coffee. A croissant. Absolutely no talking until all three are complete',
      'Sleeping until noon tbh',
      'Sleeping.'
    ],
    opening: true,
    options: [
      {text: 'So you\'re telling me a brunch date with you is just us silently eating croissants. I\'m in.', score: 170, brilliant: true, why: 'Brilliant: you used their rule as a frame for a date. Funny, bold, easy yes.'},
      {text: 'That\'s lazy', score: -180, why: 'Judgement on their ideal. Ouch.'},
      {text: 'Respect the rules. Coffee order?', score: 100, why: 'Plays along and asks for one more detail. Good.'},
      {text: 'I wake up at 5 every day to work out', score: -60, why: 'A flex that answers nothing.'}
    ]
  }, {
    them: [
      'Lmao the silent croissant date. That\'s honestly my love language',
      'Oat flat white. Don\'t judge',
      'Just black coffee.'
    ],
    options: [
      {text: 'I know a café that does great croissants and doesn\'t open until 11. It\'s fate.', score: 150, why: 'Brings a concrete place into the joke. Strong.'},
      {text: 'Noted. I\'m going to remember that.', score: 70, why: 'Attentive. Slightly mysterious. Good.'},
      {text: 'Gross', score: -160, why: 'Disgust as banter needs warmth around it. This has none.'},
      {text: 'Does Maya know we\'re talking?', score: -90, why: 'Bringing the group into the DM. Awkward energy.'}
    ]
  }, {
    them: [
      'Wait. A café that opens at 11?? Where',
      'Oh which café?',
      'Which one?'
    ],
    opening: true,
    options: [
      {text: 'I\'ll show you. Saturday, 11:15, silence guaranteed until the croissant.', score: 170, why: 'The answer is the date. Best.'},
      {text: 'Le Petit, on Market St.', score: 10, why: 'Useful, and you gave away the reason to meet.'},
      {text: 'Google it lol', score: -180, why: 'They asked you to lead and you sent them to a search engine. Dismissive.'},
      {text: 'Why, you wanna go with me? 😳', score: 60, why: 'Puts the decision on them. Not bad, not bold.'}
    ]
  }, {
    them: [
      'Okay that\'s actually perfect. It\'s a date. A silent one',
      'Haha okay, Saturday works',
      'Hmm I\'m not sure, I barely know you'
    ],
    options: [
      {text: 'The quietest date in history. I\'ll bring a notepad for emergencies.', score: 140, why: 'Matches the frame to the end. Win.'},
      {text: 'Totally fair. Maybe we all go to brunch with the group first?', score: 110, why: 'Reads their hesitation and offers a safe version. Smart.'},
      {text: 'Your loss then', score: -400, why: 'Blunder: punishing hesitation is the fastest way to lose.'},
      {text: 'ok', score: -50, why: 'The waiting move, again.'}
    ]
  }],
  endings: {
    win: 'Saturday 11:15. Not a word until the croissant 🥐🤫',
    draw: 'Haha you\'re funny, see you in the group chat!',
    loss: '*leaves the group chat*'
  }
}, {
  id: 'dog-photo',
  title: 'The dog photo',
  setting: 'You matched. Their first photo is them with a very fluffy dog. They message first.',
  opener: 'Hi! I\'ll be honest, I swiped right because of your playlist',
  turns: [{
    options: [
      {text: 'And I swiped right because of your dog. So we both came for the side characters.', score: 170, book: true, why: 'Opening theory: mirror their honesty with a playful twist.'},
      {text: 'Haha thanks! What\'s your favorite song on it?', score: 110, why: 'Friendly and keeps it about them. Good.'},
      {text: 'Thanks', score: -90, why: 'They opened with a joke. You answered with a receipt.'},
      {text: 'Only the playlist? 😏', score: 40, why: 'Fishing for a compliment, lightly. Risky but not wrong.'}
    ]
  }, {
    them: [
      'HAHA fair. He\'s honestly the main character. His name is Biscuit',
      'Haha he\'s my baby. His name is Biscuit',
      'His name is Biscuit.'
    ],
    opening: true,
    options: [
      {text: 'Biscuit!! Okay, I need a full introduction. Good boy or chaos goblin?', score: 150, why: 'Enthusiasm for what they love, with a fun binary question.'},
      {text: 'I\'m more of a cat person tbh', score: -120, why: 'Not a crime — but you just turned their favourite topic into a disagreement.'},
      {text: 'Cute name', score: 20, why: 'Polite. Also a missed opening: they handed you a whole topic.'},
      {text: 'I\'d like to formally request a meeting with Biscuit. You can come too.', score: 170, brilliant: true, why: 'Brilliant: you asked for a date by asking for the dog. Disarming and funny.'}
    ]
  }, {
    them: [
      'Lmao he would LOVE that. He\'s a chaos goblin with a heart of gold',
      'Haha a good boy mostly. Do you have pets?',
      'He\'s a good boy. Do you have pets?'
    ],
    options: [
      {text: 'No pets, but I\'m excellent at throwing a ball. Biscuit could use an intern.', score: 140, why: 'Answers and puts yourself into their world. Great.'},
      {text: 'No', score: -100, why: 'A one-word answer to a question meant to keep things going.'},
      {text: 'A cat named Pancake who\'d absolutely bully Biscuit.', score: 120, why: 'Cute, specific and opens a playful rivalry.'},
      {text: 'Pets are a lot of work honestly', score: -90, why: 'A complaint about the thing they love.'}
    ]
  }, {
    them: [
      'Okay we need a Biscuit park date. He insists',
      'Haha we should take him to the park sometime',
      'Haha maybe'
    ],
    opening: true,
    options: [
      {text: 'I never argue with a dog. Sunday morning? I\'ll bring treats for both of you.', score: 170, why: 'Accepts with a specific time and a light joke. Best.'},
      {text: 'Sure, maybe sometime', score: -80, why: 'They opened the door, you said "maybe". Classic Miss.'},
      {text: 'Is Biscuit going to be our chaperone?', score: 90, why: 'Funny, and says yes implicitly.'},
      {text: 'I don\'t really like parks', score: -200, why: 'Turning down the date to talk about parks.'}
    ]
  }, {
    them: [
      'Sunday works!! Biscuit is already excited (I told him)',
      'Haha sure, Sunday could work',
      'I\'ll see how my week goes'
    ],
    options: [
      {text: 'Tell him I\'m bringing the good tennis ball. Riverside park at 10?', score: 150, why: 'Specific place and time, with Biscuit in the frame. Clean.'},
      {text: 'No pressure — the offer stands whenever you two are free.', score: 110, why: 'Calm and generous. Great when they waver.'},
      {text: 'You\'re not even that into me are you', score: -350, why: 'Blunder: insecurity at the finish line.'},
      {text: 'Cool', score: -40, why: 'A waiting move.'}
    ]
  }, {
    them: [
      'It\'s a date. Biscuit says woof',
      'See you Sunday!',
      'Okay, I\'ll let you know'
    ],
    options: [
      {text: 'Woof received. See you both Sunday 🐶', score: 140, why: 'A perfect, short close.'},
      {text: 'Can\'t wait to meet you. Biscuit\'s okay too I guess.', score: 120, why: 'A tease that says the quiet part. Charming.'},
      {text: 'Bring snacks for me too', score: -20, why: 'Funny-ish, slightly demanding.'},
      {text: 'Whatever works lol', score: -60, why: 'Under-invested at the end.'}
    ]
  }],
  endings: {
    win: 'Sunday, Riverside park. Biscuit approves 🐕💘',
    draw: 'Haha Biscuit says hi! Talk soon',
    loss: 'Biscuit has decided you\'re not the one. Sorry!'
  }
}];

export default SCENARIOS;
