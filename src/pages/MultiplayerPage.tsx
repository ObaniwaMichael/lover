import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Share2, Smile, Send, Hash, Copy, Users, Plus, Heart, MessageCircle, Image as ImageIcon, Crown } from "lucide-react";
import { io, Socket } from "socket.io-client";
import HamburgerMenu from "@/components/HamburgerMenu";
import TruthOrDareSpinner from "@/components/TruthOrDareSpinner";
import { useAuth } from "@/hooks/useAuth";
import { SocketMessage } from "@/types/socket";
import logger from "@/lib/logger";
import { jsonAuthHeaders } from "@/lib/auth-headers";
import API_ENDPOINTS from "@/config/api";
import { getSocketUrl, getOnboardingUrl } from "@/config/site";
import { toast } from "sonner";

/** Row from GET /api/multiplayer/sessions (enriched list). */
interface ListedMultiplayerSession {
  session_id: string;
  title?: string | null;
  currentParticipants?: number;
  created_at?: string;
}

const MultiplayerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState("");
  const [isInSession, setIsInSession] = useState(false);
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showNumberSelector, setShowNumberSelector] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [playerName, setPlayerName] = useState("");
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isJoiningSession, setIsJoiningSession] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [showTruthOrDare, setShowTruthOrDare] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [truthOrDareResult, setTruthOrDareResult] = useState<{type: string, content: string, difficulty: string, playerName: string} | null>(null);
  const [showTruthOrDarePopup, setShowTruthOrDarePopup] = useState(false);
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [showCreateNamedSession, setShowCreateNamedSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [availableSessions, setAvailableSessions] = useState<ListedMultiplayerSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Mock questions for numbers 1-400
  const questions = [
  "Birthday",
  "Worst mistake",
  "Ur greatest fear",
  "Crush",
  "Best colour",
  "Do u or have u smoked?",
  "Do u drink alcohol?",
  "Do u go for nyt parties?",
  "Last time u cried and wat caused it",
  "Ur dreams",
  "Have u or do u maturate?",
  "Happiest moment",
  "Best memory",
  "Last kiss and wit who",
  "Do you watch porn?",
  "Your best body part",
  "Ever been fucked hard nd u cried?",
  "Complete d**k",
  "Complete p***y",
  "Ur most enjoyable sex,tel me abt it in details",
  "Full name",
  "If u have d chance wil u date me?",
  "Will u kiss me?",
  "Kiss or hug",
  "Favorite song",
  "Favorite movie",
  "Ever kissed a same gender person?",
  "Do u love bj?",
  "Send me ur number",
  "Ever maked out?",
  "Wanna explore me?",
  "Wanna kiss me?",
  "Wanna fuck me?",
  "Wanna date me?",
  "Ever been abused?",
  "Best hubby",
  "Tel me 3 deepest secrets",
  "Send me ur nude pics or porn videos",
  "Favorite body part of ur opposite gender",
  "Big dicks or normal dicks",
  "Big pussy or normal pussy",
  "Promise to kiss me wen we meet",
  "Tell me how u really feel about me",
  "Tell me a story",
  "Do u wear bra?",
  "Do u always wear pant?",
  "Promise to watch porn wit me or gv me a Bj",
  "Will u let me finger u or stroke ur dick?",
  "Wat age did u have ur first sex",
  "Wat year did u have ur first sex",
  "Player or loyal",
  "Single or taken",
  "Have you ever been played?",
  "Have you ever played someone?",
  "Tell me an erotic story",
  "Last sex",
  "Ever had sex wit a same gender person?",
  "Use my pic as ur dp for 1 week",
  "Send me ur breast or chest picture",
  "Do u sex chat?",
  "If u see me naked, wat will u do",
  "Shy or bold",
  "Ever slept naked?",
  "Virgin?",
  "Wat turns u on",
  "What do you love doing the most",
  "Ever begged for sex?",
  "D craziest tin u have ever done",
  "Best friend",
  "Ever had sex?",
  "Age",
  "Are you naughty?",
  "Naughtiest tin u have ever done",
  "Ever exchanged nude?",
  "Buy me a gift",
  "Wil you let me touch you?",
  "Do you love me?",
  "How do you want d dick or pussy to be.",
  "Sex chat with me",
  "Have some mistakenly seeing ur dick or pussy?",
  "What gets u wet",
  "Last time u felt like having sex",
  "Favorite clothes",
  "Ask me anything",
  "Promise to have sex with me",
  "Nickname",
  "Favorite sex position",
  "How long do you want sex to be.",
  "Do you love sex?",
  "Something u will change about yourself",
  "Send me two of your sexiest pics",
  "Tell me how you had ur last time sex in details",
  "How much do you enjoy sex",
  "Tell me things you want from me.",
  "Hard fuck or normal",
  "Send me 2 pics of your dick",
  "Send me 2 pics of your pussy",
  "Hairy dick/pussy or shaved",
  "Send me your dance videos",
  "Will you fuck me?",
  "Ever fucked someone you don't love?",
  "What do you like in a girl",
  "What do you like in a boy",
  "Tell me things you want us to do together",
  "Send me a sex video of yourself",
  "How much do you love sex.",
  "Do you prefer being sucked on your pussy or rather have sex.",
  "Are you horny right now",
  "Do you prefer being sucked on your dick or rather have sex",
  "kiss each other for a whole minute",
  "will you give me a lap dance",
  "what is your favorite body part on a girl?",
  "which do you prefer wet or dry kiss",
  "what is your favorite body part on a boy",
  "have you ever had a sex dream",
  "what on your mind right now",
  "will you come over my place",
  "if we were both inside the room what will you do to me?",
  "What don't you like about me?",
  "Did you like your first kiss?",
  "Have you ever decided to kiss or make out with a guy just because you were Horny?",
  "Which do you like the most, your boobs or your bum?",
  "What are you wearing right now?",
  "If you ask me to do something naughty what would you prefer I do?",
  "Missionary or doggy-style?",
  "What turns you on the most in a guy?",
  "Is it okay if I kiss you?",
  "How you react if I kissed you immediately I see you next time?",
  "How did you get so beautiful?",
  "Assuming we were stuck together alone in a house for a whole day, what do you think we would do?",
  "What color of panties do you prefer and why?",
  "What is the color of the underpants you are wearing right now?",
  "Are you a boobs or ass man?",
  "Where you do like being touched the most?",
  "Have you ever thought about kissing me?",
  "What if I was naked and laying in your bed?",
  "Do you want to help keep my body warm?",
  "How long do you think a guy should last on bed?",
  "Do you like cooking?",
  "Who is your favorite celebrity?",
  "Have you ever had a crush on one of your cousins?",
  "What is your worst habit?",
  "Have you ever dated two girls at the same time?",
  "While you are kissing, what types of other things you prefer to be done simultaneously?",
  "Did you know I can make you shake all over if you let me rub my cap on your clit?",
  "What do my lips taste like?",
  "How do you feel about being fingered?",
  "Where do you like it best? Back or front?",
  "Where is somewhere in my house you would like to have sex in apart fro the bedroom?",
  "Do you want me to talk dirty?",
  "Show me a porn video you'd want us to act out together",
  "Try not to get turned on while I sit on your lap and kiss your neck for 60 seconds.",
  "Would you rather spank someone or be spanked?",
  "Kiss my nipple for 60 seconds.",
  "What's your biggest sexual fear?",
  "If you had to fuck one animal, what animal would you pick?",
  "Do you love me? How much?",
  "Would you take a shower with me?",
  "How often do you watch something naughty?",
  "How often do you trim down there?",
  "How many people have seen you naked?",
  "What are you wearing?",
  "What's something you want me to do to you?",
  "Wide or tight p***y",
  "How many kids would you like to have?",
  "Twerk on my lap with only your underwear",
  "wanna suck my pussy?",
  "wanna suck my dick?",
  "Do you prefer rough or slow sex?",
  "Do you like your partner to be silent or loud?",
  "Have you ever cheated in an exam?",
  "When was the first time that you watched porn?",
  "Tell me a Dirty Truth about you that no one else knows?",
  "Do you think I'm Hot?",
  "Who would you most like to make out with?",
  "When is the last time that you touched yourself?",
  "Do you ever walk around in public without any underwear on?",
  "What do you think is the absolutely sexiest part of my body?",
  "If I was tied down to the bed right now, what would you do to me?",
  "Have you ever accidentally grabbed someones butt?",
  "Name one celebrity you would want to make out with",
  "When was the last time you masturbated?",
  "Do you like to listen to music while having sex?",
  "Kiss me passionately?",
  "Tell me how you would make love to me.",
  "Tell me something to get me aroused.",
  "Does naughty talk get you aroused?",
  "Have you ever witnessed people having sex?",
  "which do u prefer, fuck through panties? or fuck without panties?",
  "will u romance me without being asked?",
  "Call me and say \"I Love You\" along with my name as loud as you can.",
  "Do you prefer texting me or talking to me on the phone?",
  "If you were famous, what would you be famous for?",
  "if I was in the mood for sex, will u give it to me?",
  "What's one thing you can't live without?",
  "What's the last thing you searched on your phone?",
  "Of the people in this room, who do you most want to make out with?",
  "What's your biggest sexual fear?",
  "if your p***y was the key to my success will you give it to me",
  "How do you really feel about sex?",
  "How would you feel if my dick was on your pussy right now?",
  "Do you think my pussy will be sweeter than honey",
  "Do you think my dick wil be sweeter than honey",
  "Hw will u feel if my p***y was on your dick right now?",
  "Do u prefer skin to skin or condom?",
  "Do you like being lick on your pussy while sex is going on",
  "If u were to choose a sex time for both of us, how long will that be?",
  "Do I make u nervous",
  "What is your position on premarital sex?",
  "Tell me one thing I could do that would make you immediately orgasm.",
  "What is your favorite body part for me to suck on?",
  "Would you prefer to dominate me in bed or do you want me to dominate you in bed?",
  "Which is your favorite kind of sex: soft, slow, and sweet or aggressive, fast, and feisty?",
  "If we could only have sex in one position for a month, what position would you pick pussy or ass",
  "Is there something you've seen in a steamy movie that you'd like to try?",
  "What do you think is the sexiest part of your body is?",
  "Would you consider yourself flexible (in bed)?",
  "Why did you break up with your last boyfriend or girlfriend?",
  "What position have you always wanted to try?",
  "What do you wish we did in the bedroom?",
  "Where do you love to have sex?",
  "If you could have sex in any location in the world, where would it be?",
  "Where, and how, can I touch you that will turn you on?",
  "Hw will u like to be sex on your first sex",
  "If I was with you, which part of my body would you want to lick first?",
  "If I was with you right now, what would you do with me?",
  "If u were asked to give me a sex position, were will that be p***y or ass?",
  "Name three things you will like to do during sex.",
  "Hw many times a week would you want to have sex?",
  "Do you think it's possible to have a friend with benefits?",
  "If I allowed you to do anything to me what would you do?",
  "How much do you like dirty talk?",
  "How will you take it if I put my hand underneath your shirt right now?",
  "What color of underwear do you think I am wearing right now?",
  "How likely will you allow me to touch you down there?",
  "Have you ever wanted to tear my clothes off?",
  "Which position is your favorite for us?",
  "If you could choose anything on my body to see right now what would it be?",
  "What is the difference to you between sex and making love?",
  "What's your secret move to turn a guy on?",
  "What should a guy do to make you wet?",
  "Did you ever felt hot in shower while rubbing your body?",
  "Do you like your boobs being pressed?",
  "Can you tell me some reasons why I like you?",
  "Do you miss me right now?",
  "Is there anything you're too nervous to tell me in person?",
  "Do you want to see me without my shirt on?",
  "Wat part of your body will you let me touch?",
  "Would u like to be kissed while having sex?",
  "Name the sex position you would like us to try?",
  "Hw many sex position do you know?",
  "Are you a jealous person",
  "Have someone ever make an attempt to have sex with you?",
  "Would you like me to be the person that will disvirgins you?",
  "How would you feel if someone sends u pron?",
  "At wat age do u plan to get married?",
  "How long can u last in bed?",
  "Do u discuss your relationship with your friends?",
  "Wat do u feel like when sex is on your mind?",
  "Do you think we'd do something funny if we get drunk together?",
  "Do you think you're a good kisser?",
  "Where on your body would you like me to massage?",
  "What would you do if I come to you naked?",
  "What would you ask me to do for you if I were naked right now?",
  "Can you take my panties off with just your teeth?",
  "How would you start with me if I was in your bed right now?",
  "What would you do if we were home alone naked together?",
  "What would you like to hear from me while we do it?",
  "If you could only feel me in one place, where would it be?",
  "If you are still a virgin, how would you demand it?",
  "Have you ever been seduced by someone?",
  "Would you ever want to play dirty with me?",
  "Do u like me being ontop u or u being ontop me?",
  "Do you like it when I pull your hair during sex?",
  "Are u a dick sucker",
  "How can I make sex more enjoyable for you?",
  "Does knowing that people can hear us having sex turn you on?",
  "Do you consider yourself a naughty girl? If yes, prove it.",
  "What is the one thing you can never resist and that instantly gets you wet?",
  "Would you have sex with me while somebody is watching us?",
  "Would you make out with another girl while I watch?",
  "Would you like it if I sent you naked pictures of me?",
  "Are you confident about showing your naked body?",
  "Have you ever been hot for a teacher?",
  "are you a shy guy, sexually?",
  "Would you prefer my dick deep inside your pussy or at the bottom?",
  "What part of my body would you want me to tattoo?",
  "have you ever stared at my butt or chest?",
  "Is laughing in sex okay, or it has to be serious?",
  "Have you ever tried edible underwear?",
  "Do you like experimenting with different positions, or your favorite?",
  "If you could choose anything on my body to see right now what would it be?",
  "Which part of guys body you want to touch or feel?",
  "Have you ever kissed a girl?",
  "How many minutes should my d*k or p**y should stay inside yours without removing it?",
  "Wanna fuck my ass or pussy?",
  "Do you prefer to take the lead for sex?",
  "What do you think is the sexiest thing about my body?",
  "How do you like to be touched by me?",
  "How would you start with me if I was in your bed right now?",
  "Can I watch you play with your stuff",
  "Do u have a condom?",
  "Figure out how my pussy will looks like",
  "Figure out how my dick wii looks like",
  "If I was home alone and I ask for sex will u let me placed my dick on your pussy?",
  "If sex was wat I asked as a birthday gift will u give it to me?",
  "Do u think your mom was a virgin when your dad met her?",
  "If we were to have sex will u let any one knows about it?",
  "Do u prefer being sucked on your pussy before sex?",
  "Do u prefer being sucked on your dick before sex?",
  "What do you want sex, romance,wet kiss?",
  "What should I say if I wanted sex from u?",
  "Wat would you say if I said I wanted sex?",
  "if we were both shy for sex mood, hw Would u make mi interested?",
  "Who was your first girlfriend",
  "What turns you on most during sex?",
  "How many times have you been in love?",
  "Who are your ex-girlfriends, (if any) and what made the relationship end as it did?",
  "Have you ever lied to me?",
  "Will u be surprised if I ask u for sex?",
  "Last time you had a wet dream?",
  "How will it feel like to lose your virginity?",
  "Would you ever watch porn with a girl?",
  "What would you do if I put my hands under your shirt?",
  "If you are still a virgin, what do you want your first time to be like?",
  "Do you like to be loud during s..x?",
  "Do you like it when I don't wear any underwear?",
  "Do you want to cuddle with me?",
  "What is your favorite position when you are on top?",
  "Would you ever want to be blindfolded during sex?",
  "What is the quickest that you think you can undress me?",
  "Do you think you can get naked in less than 5 seconds during sex?",
  "Do you like to do it with clothes on or off?",
  "Do you want to spank me?",
  "Your lips look lonely. Do you want my lips to keep them company?",
  "Do you think that I can handle you?",
  "Do you like being naked or are you shy about it?",
  "If you realized that someone was watching you have s..x, would you stop or would you keep going?",
  "Is there anything that you would not do in bed?",
  "How long will it take you to get over here and into my pants?",
  "What is the sexiest outfit that you can think of?",
  "Does talking dirty turn you on, and do you want to try it with me?",
  "Are you into phone sex, and do you want to try it?",
  "What is the thing that makes you feel good the most during sex?",
  "Do you like foreplay or do you like going straight to business?",
  "Do you like it when I come inside you?",
  "Do you like to watch me as I change clothes?",
  "Do you like it when I touch you slowly all over your body?",
  "Which part of me do you miss the most right now?",
  "If we only had 20 minutes together, what would we do?",
  "Does thinking about me make you wet?",
  "How long should foreplay take before sex?",
  "Describe to me in detail what it feels like when I'm inside you.",
  "Do you like it when I tell you what to do?",
  "What is a sure way to turn you on within seconds?",
  "Do you prefer younger or older men?",
  "Are you enjoying these flirty questions?",
  "When was the last time you jerked off thinking of me?",
  "Do you like it when I make the first move?",
  "Do you have a name for your thing and what is it?",
  "Do you get an instant erection when you see someone naked?",
  "If you had to choose between getting head or having sex, which would you pick?",
  "Do you think I'm sexy?",
  "What is your favorite thing to do with my body?",
  "Do you like it when people can hear us having sex?",
  "When are u coming to sex me?",
  "When am I coming to make u feed good?",
  "If u were shy to ask for the sex while we are inside, will u tell me through your phone?",
  "Do u like condom to be fixed in your presence or your obsence?",
  "Do you think my dick will enter your pussy?",
  "If your p**y was so tight for my d*k, wat will u do when u are in the mood?",
  "If you were crying while I was penetrating should I stop?",
  "If my dick was on your pussy, were should I put my hands when sex is going on?",
  "Which do you prefer, eyes opend, or eyes closed while having sex?",
  "Will u Send me a photo of how my dick should be inside your p***y",
  "Will u Send me a photo of how my p**y should be inside your d*k",
  "When was a time you were so turned on you couldn't stand it?",
  "Do you ever just want to tear off my clothes?",
  "Would you prefer to see me in hot pants or a short skirt?",
  "Will u like it if I fuck you for 2 minutes?",
  "How do you like your breasts and nipples played with?",
  "When did you first learn about sex?",
  "How much eye contact do you like to have during sex?",
  "What's the sexiest movie you've ever watched?",
  "What's your favorite pair or underwear?",
  "Using three words, how do you feel about me?",
  "How do you want me?",
  "Would you like to know how I feel about you?",
  "Where would you like to have sex My place or yours?",
  "If I was at your window right now, would you invite me in?",
  "If you could kiss me goodnight every night, would you?",
  "Would you like the cap of my dick being robbed on your pussy before entering?",
  "Would you be loud or quiet during sex?",
  "Do you prefer to take control or be submissive?",
  "What would you like me to do more in bed?",
  "Is your ass soft ?",
  "What is your favorite position when you are on top?",
  "What is your favorite kind of kiss?",
  "Do you like when I take you in deep or when you take me in deep?",
  "Will you like it when I touch you there?",
  "Have u ever felt horny while texting on the phone?",
  "Who was the first girl that touch your dick?",
  "who was the first boy that touch your ass?",
  "Which girl do u think would give you the best sex?",
  "Should u prefer we watch pron before sex?",
  "Which boy do u think would give you the best sex?",
  "Who do u fantasize when u think about sex?",
  "Have you ever gone a whole day without wearing underwear?",
  "What would you do if I answered the door naked?",
  "If I was sexing u and my dick drove out from your pussy, will u put it back ur self, or should I be the one to put it back my self?",
  "Will u be mad if I already made u wet by robbing my dick ontop your pussy and didn't do any tin?",
  "Will u like your breast to be sucked"
];

  const emojis = [
  "❤️", "😊", "😂", "😍", "🥰", "😭", "😱", "😎", "🤔", "👍", "👎", "🔥", "💯", "✨", "🎉", "💔", "😢", "😡", "🤗", "😴",
  "😘", "😋", "😛", "😜", "😝", "🤪", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😤",
  "😠", "😦", "😧", "😨", "😰", "😥", "😓", "🤗", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😯", "😦", "😧", "😮", "😲", "🥱",
  "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "💩", "👻", "💀", "☠️", "👽", "👾",
  "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈", "🙉", "🙊", "🐵", "🐒", "🦍", "🦧", "🐶", "🐕", "🦮",
  "🐩", "🐺", "🦊", "🦝", "🐱", "🐈", "🦁", "🐯", "🐅", "🐆", "🐴", "🐎", "🦄", "🦓", "🦌", "🐮", "🐂", "🐃", "🐄", "🐷",
  "🐖", "🐗", "🐽", "🐏", "🐑", "🐐", "🐪", "🐫", "🦙", "🦒", "🐘", "🦏", "🦛", "🐭", "🐁", "🐀", "🐹", "🐰", "🐇", "🐿️", "🦔",
  "🦇", "🐻", "🐨", "🐼", "🦥", "🦦", "🦡", "🦃", "🐔", "🐓", "🐣", "🐤", "🐥", "🐦", "🐧", "🕊️", "🦅", "🦆", "🦢", "🦉", "🦩",
  "🦚", "🦜", "🐸", "🐊", "🐢", "🦎", "🐍", "🐲", "🐉", "🦕", "🦖", "🐳", "🐋", "🐬", "🐟", "🐠", "🐡", "🦈", "🐙", "🐚", "🐌",
  "🦋", "🐛", "🐜", "🐝", "🐞", "🦗", "🕷️", "🕸️", "🦂", "🦟", "🦠", "💐", "🌸", "💮", "🏵️", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷",
  "🌱", "🌲", "🌳", "🌴", "🌵", "🌾", "🌿", "☘️", "🍀", "🍁", "🍂", "🍃", "🍄", "🌰", "🦠", "🎃", "🎄", "🎋", "🎍", "🎎", "🎏",
  "🎐", "🎀", "🎁", "🎗️", "🎟️", "🎫", "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🥎", "🏀", "🏈", "⚽", "🏉", "🎾", "🥏",
  "🎳", "🏏", "🏑", "🏒", "🥍", "🏓", "🏸", "🥅", "🏒", "🏓", "🏸", "🥊", "🥋", "🥌", "🎿", "⛷️", "🏂", "🏋️‍♀️", "🏋️‍♂️", "🤺", "🤾‍♀️",
  "🤾‍♂️", "🏌️‍♀️", "🏌️‍♂️", "🏇", "🧘‍♀️", "🧘‍♂️", "🏄‍♀️", "🏄‍♂️", "🏊‍♀️", "🏊‍♂️", "🤽‍♀️", "🤽‍♂️", "🚣‍♀️", "🚣‍♂️", "🧗‍♀️", "🧗‍♂️", "🚵‍♀️", "🚵‍♂️", "🚴‍♀️", "🚴‍♂️",
  "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️", "🎪", "🤹‍♀️", "🤹‍♂️", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹", "🥁",
  "🎷", "🎺", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳", "🎮", "🎰", "🧩", "🎨", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️",
  "💽", "💾", "💿", "📀", "🧮", "🎥", "📺", "📻", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "🏮", "🪔", "📔", "📕",
  "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑", "🔖", "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷",
  "🪙", "💳", "🧾", "💸", "💱", "💲", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳️", "🪧", "🏣",
  "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "⛲",
  "⛺", "🌁", "🌃", "🏙️", "🌄", "🌅", "🌆", "🌇", "🌉", "♨️", "🎠", "🎡", "🎢", "💈", "🎪", "🚂", "🚃", "🚄", "🚅", "🚆", "🚇",
  "🚈", "🚉", "🚊", "🚝", "🚞", "🚋", "🚌", "🚍", "🚎", "🚐", "🚑", "🚒", "🚓", "🚔", "🚕", "🚖", "🚗", "🚘", "🚙", "🛻", "🚚",
  "🚛", "🚜", "🏎️", "🏍️", "🛵", "🦽", "🦼", "🛴", "🚲", "🛶", "🛥️", "🚁", "🛩️", "✈️", "🛫", "🛬", "🪂", "💺", "🛰️", "🚀",
  "🛸", "🛎️", "🧳", "⌛", "⏰", "⏱️", "⏲️", "🕰️", "🕛", "🕧", "🕐", "🕜", "🕑", "🕝", "🕒", "🕞", "🕓", "🕟", "🕔", "🕠",
  "🕕", "🕡", "🕖", "🕢", "🕗", "🕣", "🕘", "🕤", "🕙", "🕥", "🕚", "🕦", "🕙", "🕥", "🕚", "🕦", "🌑", "🌒", "🌓", "🌔", "🌕",
  "🌖", "🌗", "🌘", "🌙", "🌚", "🌛", "🌜", "🌡️", "☀️", "🌝", "🌞", "⭐", "🌟", "🌠", "☁️", "⛅", "⛈️", "🌤️", "🌥️", "🌦️", "🌧️",
  "🌨️", "🌩️", "🌪️", "🌫️", "🌬️", "🌈", "☂️", "☔", "⚡", "❄️", "☃️", "⛄", "☄️", "💧", "🔥", "🌊", "🎃", "🎄", "🎋", "🎍", "🎎",
  "🎏", "🎐", "🎀", "🎁", "🎗️", "🎟️", "🎫", "🎖️", "🏆", "🏅", "🥇", "🥈", "🥉", "⚽", "⚾", "🥎", "🏀", "🏈", "⚽", "🏉", "🎾", "🥏"
];

  // Clear old cache on mount to ensure fresh state
  useEffect(() => {
    // Clear any stale cache entries
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          if (name.includes('lover') || name.includes('multiplayer')) {
            caches.delete(name);
          }
        });
      });
    }
  }, []);

  // Restore session from localStorage on page load (but don't auto-rejoin)
  // Only restore the sessionId and playerName to pre-fill the form
  useEffect(() => {
    try {
      const savedSessionId = localStorage.getItem('multiplayerSessionId');
      const savedPlayerName = localStorage.getItem('multiplayerPlayerName') || user?.username;
      
      if (savedSessionId && savedSessionId.trim()) {
        const trimmedSessionId = savedSessionId.trim();
        setSessionId(trimmedSessionId);
        if (savedPlayerName) {
          setPlayerName(savedPlayerName);
        }
        // Don't auto-rejoin - let user choose to join or create new session
        // The sessionId is pre-filled in the input field for convenience
        logger.log('Restored session from localStorage (not auto-joining):', trimmedSessionId);
      }
    } catch (error) {
      logger.error('Error restoring session from localStorage:', error);
      // Clear potentially corrupted localStorage
      try {
        localStorage.removeItem('multiplayerSessionId');
        localStorage.removeItem('multiplayerPlayerName');
      } catch (clearError) {
        logger.error('Error clearing localStorage:', clearError);
      }
    }
  }, [user?.username]);

  useEffect(() => {
    if (isInSession && sessionId && sessionId.trim()) {
      const trimmedSessionId = sessionId.trim();
      const socketUrl = getSocketUrl();
      
      // Clean up any existing socket connection
      if (socketRef.current) {
        try {
          socketRef.current.removeAllListeners();
          socketRef.current.disconnect();
        } catch (error) {
          logger.error('Error cleaning up previous socket:', error);
        }
      }
      
      const socket = io(socketUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        reconnectionAttempts: Infinity,
        timeout: 20000,
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        forceNew: false,
        // Matches backend/server.js — recover missed packets after brief disconnects (still not magic for long outages)
        connectionStateRecovery: {
          maxDisconnectionDuration: 2 * 60 * 1000,
        },
      });
      socketRef.current = socket;

      const nudgeReconnect = () => {
        if (socket.disconnected) socket.connect();
      };
      window.addEventListener("online", nudgeReconnect);
      const onVisibility = () => {
        if (document.visibilityState === "visible") nudgeReconnect();
      };
      document.addEventListener("visibilitychange", onVisibility);

      socket.on("connect", () => {
        setIsConnected(true);
        setConnectionStatus("Connected");
        logger.log("Connected to server");
        
        // Join session after connection is established
        socket.emit("join-session", { 
          sessionId: trimmedSessionId, 
          playerName: playerName || user?.username || "Anonymous" 
        });
      });

      socket.on("disconnect", (reason) => {
        setIsConnected(false);
        setConnectionStatus("Reconnecting…");
        logger.log("Disconnected from server:", reason);
        
        // Only show error if it's not a normal disconnection
        if (reason === 'io server disconnect' || reason === 'transport close') {
          setMessages((prev) => [...prev, {
            text: "⚠️ Connection lost. Reconnecting...",
            sender: "System",
            timestamp: new Date()
          }]);
        }
      });

      socket.on("reconnect", (attemptNumber) => {
        logger.log("Reconnected after", attemptNumber, "attempts");
        setIsConnected(true);
        setConnectionStatus("Connected");
        setMessages((prev) => [...prev, {
          text: "✅ Reconnected to server",
          sender: "System",
          timestamp: new Date()
        }]);
        
        // Rejoin session after reconnection
        socket.emit("join-session", { 
          sessionId: trimmedSessionId, 
          playerName: playerName || user?.username || "Anonymous" 
        });
      });

      socket.on("reconnect_error", (error) => {
        logger.error("Reconnection error:", error);
        setConnectionStatus("Reconnecting...");
      });

      socket.on("reconnect_failed", () => {
        setIsConnected(false);
        setConnectionStatus("Connection failed");
        logger.error("Failed to reconnect after all attempts");
        setMessages((prev) => [...prev, {
          text: "❌ Failed to reconnect. Please refresh the page.",
          sender: "System",
          timestamp: new Date()
        }]);
      });

      // Handle server ping to keep connection alive
      socket.on("ping", () => {
        socket.emit("pong", { timestamp: Date.now() });
      });

      socket.on("connect_error", (error) => {
        setIsConnected(false);
        setConnectionStatus("Connection failed");
        logger.error("Connection error:", error);
        logger.error("Socket connection failed:", error);
        
        // Add user-friendly error message
        setMessages((prev) => [...prev, {
          text: "❌ Failed to connect to server. Please check your internet connection and try again.",
          sender: "System",
          timestamp: new Date()
        }]);
      });

      socket.on("error", (error) => {
        logger.error("Socket error:", error);
        logger.error("Socket error:", error);
        setMessages((prev) => [...prev, {
          text: "❌ Connection error occurred. Please refresh the page.",
          sender: "System",
          timestamp: new Date()
        }]);
      });

      // Listen for chat history when rejoining a session
      socket.on("chat-history", (data: {sessionId: string, messages: Array<{text: string, sender: string, timestamp: string, playerName?: string, type?: string, imageData?: string, imageUrl?: string}>}) => {
        if (data.sessionId === trimmedSessionId && data.messages && data.messages.length > 0) {
          logger.log(`Loading ${data.messages.length} previous messages`);
          const historyMessages: SocketMessage[] = data.messages.map((msg) => ({
            text: msg.text,
            sender: msg.playerName || msg.sender,
            timestamp: new Date(msg.timestamp),
            playerName: msg.playerName || msg.sender,
            type: msg.type || 'text',
            imageData: msg.imageData,
            imageUrl: msg.imageUrl
          }));
          setMessages(historyMessages);
        }
      });

      // Listen for session join confirmation
      socket.on("session-joined", (data: {sessionId: string, playerName: string, participantCount: number}) => {
        logger.log("Successfully joined session:", data);
        setMessages((prev) => {
          // Only add system message if we don't already have messages (from history)
          if (prev.length === 0) {
            return [{
              text: `✅ Connected to session. ${data.participantCount} participant(s) online.`,
              sender: "System",
              timestamp: new Date()
            }];
          }
          // If we have history, append the system message
          return [...prev, {
            text: `✅ Connected to session. ${data.participantCount} participant(s) online.`,
            sender: "System",
            timestamp: new Date()
          }];
        });
      });

      socket.on("user-joined", (data) => {
        setPartnerOnline(true);
        const joinedPlayerName = data.playerName || "Partner";
        setMessages((prev) => [...prev, {
          text: `${joinedPlayerName} joined the session`,
          sender: "System",
          timestamp: new Date()
        }]);
        logger.log("Partner joined:", data);
      });

      socket.on("user-left", (data) => {
        setPartnerOnline(false);
        const leftPlayerName = data.playerName || "Partner";
        setMessages((prev) => [...prev, {
          text: `${leftPlayerName} left the session`,
          sender: "System",
          timestamp: new Date()
        }]);
        logger.log("Partner left:", data);
      });

      socket.on("chat message", (msg: {text: string, sender: string, timestamp: string | Date, playerName?: string, type?: string, imageData?: string, imageUrl?: string, sessionId?: string}) => {
        // Convert timestamp to Date object if it's a string
        const msgTimestamp = typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp;
        const msgSender = msg.playerName || msg.sender;
        const msgText = msg.text || '';
        const msgImageData = msg.imageData || msg.imageUrl || '';
        const msgType = msg.type || 'text';
        
        // Generate a more robust unique ID for the message to prevent duplicates
        // Use content hash instead of exact timestamp to catch duplicates even with slight timestamp differences
        const contentHash = `${msgText}${msgImageData}`.substring(0, 50); // First 50 chars of content
        const messageId = `${msg.sessionId || trimmedSessionId}-${msgSender}-${contentHash}-${Math.floor(msgTimestamp.getTime() / 1000)}`; // Round to seconds
        
        const messageWithDate = {
          ...msg,
          id: messageId,
          timestamp: msgTimestamp,
          sender: msgSender,
          type: msgType,
          imageData: msg.imageData,
          imageUrl: msg.imageUrl
        };
        
        // Prevent duplicate messages with improved detection
        setMessages((prev) => {
          // Check for exact ID match first (fastest)
          if (prev.some(m => m.id === messageId)) {
            logger.log('🚫 Duplicate message detected (ID match):', messageId);
            return prev;
          }
          
          // Check for content-based duplicates (same sender, same content, within 2 seconds)
          const isDuplicate = prev.some(m => {
            const timeDiff = Math.abs(new Date(m.timestamp).getTime() - msgTimestamp.getTime());
            const sameSender = (m.sender === msgSender || m.playerName === msgSender);
            const sameContent = (m.text === msgText && m.type === msgType);
            const sameImage = (!msgImageData || (m.imageData === msg.imageData || m.imageUrl === msg.imageUrl));
            
            // If same sender, same content, and within 2 seconds, it's a duplicate
            if (sameSender && sameContent && sameImage && timeDiff < 2000) {
              return true;
            }
            return false;
          });
          
          if (isDuplicate) {
            logger.log('🚫 Duplicate message detected (content match):', { sender: msgSender, text: msgText.substring(0, 20) });
            return prev;
          }
          
          return [...prev, messageWithDate];
        });
      });

      socket.on("question-asked", (data: {question: string, playerName?: string, sessionId?: string}) => {
        const currentPlayerName = playerName || user?.username || "Anonymous";
        // Only show popup if the question is from someone else (not the sender)
        // Sender already added the message in askQuestion function, so no need to add here
        if (data.playerName && data.playerName !== currentPlayerName) {
          setCurrentQuestion(data.question);
          setShowQuestionDialog(true);
        }
      });

      socket.on("question-answered", (data: {question: string, answer: string, sender: string, playerName?: string}) => {
        const answererName = data.playerName || (data.sender === "You" ? "Partner" : "You");
        setMessages((prev) => [...prev, {
          text: `Q: ${data.question}\nA: ${data.answer}`,
          sender: answererName,
          timestamp: new Date()
        }]);
      });

      // Listen for Truth or Dare results - show popup that fades away
      socket.on("truth-or-dare-spin-result", (data: {result: {type: string, content: string, difficulty: string}, playerName: string, sessionId: string, timestamp: string}) => {
        if (data.sessionId === trimmedSessionId) {
          // Show popup that will fade away
          setTruthOrDareResult({
            type: data.result.type,
            content: data.result.content,
            difficulty: data.result.difficulty,
            playerName: data.playerName
          });
          setShowTruthOrDarePopup(true);
          
          // Auto-hide popup after 5 seconds with fade
          setTimeout(() => {
            setShowTruthOrDarePopup(false);
            // Clear result after fade animation completes
            setTimeout(() => setTruthOrDareResult(null), 500);
          }, 5000);
        }
      });

      return () => {
        window.removeEventListener("online", nudgeReconnect);
        document.removeEventListener("visibilitychange", onVisibility);
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [isInSession, sessionId, playerName, user?.username]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createNewSession = async () => {
    if (isCreatingSession) {
      return; // Prevent double-clicking
    }
    
    setIsCreatingSession(true);
    
    try {
      // Generate a more unique session ID with timestamp
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6);
      const newSessionId = `${timestamp}${random}`.toUpperCase();
      setSessionId(newSessionId);
      
      // Save session to localStorage for persistence
      localStorage.setItem('multiplayerSessionId', newSessionId);
      if (playerName || user?.username) {
        localStorage.setItem('multiplayerPlayerName', playerName || user?.username || 'Anonymous');
      }
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // If user is not logged in, show name dialog
      if (!user) {
        setShowNameDialog(true);
        setIsCreatingSession(false);
      } else {
        setIsInSession(true);
        setIsCreatingSession(false);
        toast.success('Session created!');
      }
    } catch (error) {
      logger.error('Error creating session:', error);
      toast.error('Failed to create session. Please try again.');
      setIsCreatingSession(false);
    }
  };

  const joinSession = async () => {
    if (!sessionId.trim()) {
      toast.error('Please enter a session code');
      return;
    }
    
    if (isJoiningSession) {
      return; // Prevent double-clicking
    }
    
    setIsJoiningSession(true);
    
    try {
      // Save session to localStorage for persistence
      localStorage.setItem('multiplayerSessionId', sessionId.trim());
      if (playerName || user?.username) {
        localStorage.setItem('multiplayerPlayerName', playerName || user?.username || 'Anonymous');
      }
      
      // Small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // If user is not logged in, show name dialog
      if (!user) {
        setShowNameDialog(true);
        setIsJoiningSession(false);
      } else {
        setIsInSession(true);
        setIsJoiningSession(false);
        toast.success('Joining session...');
      }
    } catch (error) {
      logger.error('Error joining session:', error);
      toast.error('Failed to join session. Please try again.');
      setIsJoiningSession(false);
    }
  };

  const handleNameSubmit = () => {
    if (playerName.trim()) {
      // Save player name to localStorage
      localStorage.setItem('multiplayerPlayerName', playerName);
      setShowNameDialog(false);
      setIsInSession(true);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessages((prev) => [...prev, {
        text: "❌ Please select an image file.",
        sender: "System",
        timestamp: new Date()
      }]);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessages((prev) => [...prev, {
        text: "❌ Image size must be less than 5MB.",
        sender: "System",
        timestamp: new Date()
      }]);
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Image = event.target?.result as string;
      setSelectedImage(base64Image);
      sendImageMessage(base64Image, file.type);
    };
    reader.onerror = () => {
      setMessages((prev) => [...prev, {
        text: "❌ Failed to read image file.",
        sender: "System",
        timestamp: new Date()
      }]);
    };
    reader.readAsDataURL(file);
  };

  const sendImageMessage = (imageData: string, imageType: string) => {
    if (socketRef.current && isConnected && sessionId) {
      setIsUploadingImage(true);
      const currentPlayerName = playerName || user?.username || "Anonymous";
      const message = {
        text: "📷 Image",
        sender: currentPlayerName,
        timestamp: new Date().toISOString(),
        type: 'image',
        imageData: imageData,
        imageType: imageType
      };

      // Don't add locally - wait for broadcast to avoid duplicates
      // Send to server (will broadcast to all including sender)
      socketRef.current.emit("chat message", { ...message, sessionId });
      
      setSelectedImage(null);
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setMessages((prev) => [...prev, {
        text: "❌ Not connected to server. Please wait for connection.",
        sender: "System",
        timestamp: new Date()
      }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage) {
      return;
    }
    
    if (trimmedMessage.length > 2000) {
      toast.error('Message too long. Please keep it under 2000 characters.');
      return;
    }
    
    if (isSendingMessage) {
      return; // Prevent double-sending
    }
    
    if (socketRef.current && isConnected) {
      setIsSendingMessage(true);
      const currentPlayerName = playerName || user?.username || "Anonymous";
      const message = {
        text: trimmedMessage,
        sender: currentPlayerName,
        timestamp: new Date().toISOString(), // Use ISO string for consistency with backend
        type: 'text'
      };
      
      // Verify we're in a session
      if (!sessionId) {
        toast.error('No session ID. Please join a session first.');
        setIsSendingMessage(false);
        return;
      }
      
      try {
        // Don't add locally - wait for broadcast to avoid duplicates
        // The server will broadcast to all including sender, so we'll receive it via socket
        socketRef.current.emit("chat message", { ...message, sessionId });
        
        // Clear input after sending
        setMessageInput("");
        // Small delay to show button feedback
        await new Promise(resolve => setTimeout(resolve, 100));
        setIsSendingMessage(false);
      } catch (error) {
        logger.error('Error sending message:', error);
        toast.error('Failed to send message. Please try again.');
        setIsSendingMessage(false);
      }
    } else {
      toast.error('Not connected to server. Please wait for connection.');
    }
  };

  const sendEmoji = (emoji: string) => {
    if (socketRef.current && isConnected) {
      const currentPlayerName = playerName || user?.username || "Anonymous";
      const message = {
        text: emoji,
        sender: currentPlayerName,
        timestamp: new Date()
      };
      // Don't add locally - wait for broadcast
      socketRef.current.emit("chat message", { ...message, sessionId });
    }
  };

  const askQuestion = (questionNumber: number) => {
    const question = questions[questionNumber - 1];
    if (socketRef.current && isConnected) {
      const currentPlayerName = playerName || user?.username || "Anonymous";
      socketRef.current.emit("ask-question", { question, sessionId, playerName: currentPlayerName });
      setMessages((prev) => [...prev, {
        text: `Asked: ${question}`,
        sender: currentPlayerName,
        timestamp: new Date()
      }]);
    }
    setShowNumberSelector(false);
  };

  const handleQuestionAnswer = () => {
    if (questionAnswer.trim() && socketRef.current) {
      const currentPlayerName = playerName || user?.username || "Anonymous";
      // Emit the question answer event to both players
      socketRef.current.emit("question-answer", {
        question: currentQuestion,
        answer: questionAnswer,
        sender: "You",
        playerName: currentPlayerName,
        sessionId
      });
      
      setQuestionAnswer("");
      setShowQuestionDialog(false);
    }
  };

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
  };

  const loadAvailableSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`${API_ENDPOINTS.MULTIPLAYER_SESSIONS}?activeOnly=true&limit=20`, { headers: jsonAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(data.sessions || []);
        if (data.sessions && data.sessions.length === 0) {
          toast.info('No active sessions found. Create a new one to get started!');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to load sessions');
        setAvailableSessions([]);
      }
    } catch (error) {
      logger.error('Error loading sessions:', error);
      toast.error('Failed to load sessions. Please check your connection and try again.');
      setAvailableSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const createNamedSession = async () => {
    if (!sessionTitle.trim()) {
      toast.error('Please enter a session name');
      return;
    }
    
    setIsCreatingSession(true);
    try {
      const response = await fetch(API_ENDPOINTS.MULTIPLAYER_SESSIONS, {
        method: 'POST',
        headers: jsonAuthHeaders(),
        body: JSON.stringify({ title: sessionTitle.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        localStorage.setItem('multiplayerSessionId', data.sessionId);
        if (playerName || user?.username) {
          localStorage.setItem('multiplayerPlayerName', playerName || user?.username || 'Anonymous');
        }
        setShowCreateNamedSession(false);
        setSessionTitle("");
        toast.success(`Session "${data.title}" created successfully!`);
        
        // If user is not logged in, show name dialog
        if (!user) {
          setShowNameDialog(true);
        } else {
          setIsInSession(true);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to create session');
      }
    } catch (error) {
      logger.error('Error creating named session:', error);
      toast.error('Failed to create session. Please check your connection and try again.');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const joinSessionFromList = (selectedSessionId: string) => {
    const trimmedSessionId = selectedSessionId.trim();
    if (!trimmedSessionId) {
      toast.error('Invalid session code');
      return;
    }
    
    try {
      setSessionId(trimmedSessionId);
      localStorage.setItem('multiplayerSessionId', trimmedSessionId);
      if (playerName || user?.username) {
        localStorage.setItem('multiplayerPlayerName', playerName || user?.username || 'Anonymous');
      }
      setShowSessionBrowser(false);
      
      // If user is not logged in, show name dialog
      if (!user) {
        setShowNameDialog(true);
      } else {
        setIsInSession(true);
        toast.success('Joining session...');
      }
    } catch (error) {
      logger.error('Error joining session from list:', error);
      toast.error('Failed to join session. Please try again.');
    }
  };

  if (!isInSession) {
  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-purple-50 to-slate-200 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800 flex items-center justify-center p-3 sm:p-4">
        <Card className="w-full max-w-sm sm:max-w-md bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-purple-200 dark:border-purple-800">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-purple-800 dark:text-purple-200">
              Join Lover's Code Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            {/* Join Session Section - Prominent First */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Join with Session Code
              </label>
              <Input
                value={sessionId}
                onChange={(e) => {
                  // Auto-trim whitespace and convert to uppercase for better UX
                  const value = e.target.value.trim().toUpperCase();
                  setSessionId(value);
                }}
                placeholder="Enter session code"
                className="border-purple-300 focus:border-purple-500 uppercase"
                maxLength={20}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && sessionId.trim()) {
                    joinSession();
                  }
                }}
              />
              <Button 
                onClick={joinSession}
                loading={isJoiningSession}
                loadingText="Joining..."
                disabled={!sessionId.trim() || isJoiningSession}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
              >
                <Users className="w-4 h-4 mr-2" />
                {isJoiningSession ? 'Joining...' : 'Join Session'}
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">
                  Or Create a Session
                </span>
              </div>
            </div>
            
            {/* Create Session Options */}
            <div className="grid grid-cols-1 gap-2">
              <Button
                onClick={createNewSession}
                loading={isCreatingSession}
                loadingText="Creating..."
                disabled={isCreatingSession}
                className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-medium transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
              >
                <Plus className="w-4 h-4 mr-2" />
                {isCreatingSession ? 'Creating...' : 'Create Quick Session'}
              </Button>
              
              <Button
                onClick={() => {
                  setShowCreateNamedSession(true);
                }}
                variant="outline"
                className="w-full border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Hash className="w-4 h-4 mr-2" />
                Create Named Session
              </Button>
              
              <Button
                onClick={async () => {
                  setShowSessionBrowser(true);
                  await loadAvailableSessions();
                }}
                variant="outline"
                className="w-full border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Users className="w-4 h-4 mr-2" />
                Browse Sessions
              </Button>
            </div>
          </CardContent>
            </Card>
                </div>
    );
  }

  return (
        <div className="h-screen h-[100dvh] bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden fixed inset-0" style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      {/* Header - Fixed at top */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-2 sm:p-3 flex items-center justify-between flex-shrink-0 z-40 relative" style={{ position: 'sticky', top: 0 }}>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-white hover:bg-purple-600/20 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-xs sm:text-base truncate">Lover's Code</h1>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs overflow-hidden">
              <span className="text-purple-100 truncate hidden sm:inline">Session: {sessionId}</span>
              <span className="text-purple-100 truncate sm:hidden">{sessionId.substring(0, 8)}...</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-purple-100 hidden sm:inline">{connectionStatus}</span>
                <span className="text-purple-100 sm:hidden text-[10px]">{isConnected ? 'On' : 'Off'}</span>
              </div>
              {partnerOnline && (
                <div className="flex items-center gap-1 flex-shrink-0 hidden sm:flex">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-400"></div>
                  <span className="text-green-200 text-[10px] sm:text-xs">Partner</span>
                </div>
              )}
            </div>
          </div>
        </div>
                    
        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/solo')}
            className="text-white hover:bg-purple-600/20"
          >
            <Heart className="w-4 h-4 mr-1" />
            Solo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/ai-companion-onboarding')}
            className="text-white hover:bg-purple-600/20"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            AI Companion
          </Button>
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600/20">
                <Share2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  🎉 Invite Your Partner
                </DialogTitle>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Share your session code and start connecting!
                </p>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
                  <Badge variant="secondary" className="font-mono text-lg px-3 py-1">{sessionId}</Badge>
                  <Button size="sm" onClick={copySessionId} className="ml-auto">
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Code
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">Share via:</p>
                  <div className="grid grid-cols-1 gap-2">
                    <Button
                      onClick={() => {
                        const onboardingUrl = getOnboardingUrl();
                        const message = encodeURIComponent(`🎉 Join me on Lover's Code!\n\nSession code: ${sessionId}\n\n📱 How to join:\n\n✨ NEW USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign Up" to create your free account\n3. Choose a username, enter your email, and create a password\n4. Once logged in, navigate to Multiplayer\n5. Click "Join Session" and enter the session code: ${sessionId}\n6. Start chatting! 💕\n\n👋 EXISTING USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign In" and enter your credentials\n3. Navigate to Multiplayer\n4. Click "Join Session" and enter the session code: ${sessionId}\n5. Start chatting! 💕\n\nLet's connect and have fun together! 🎉`);
                        window.open(`https://wa.me/?text=${message}`, '_blank');
                      }}
                      className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </Button>
                    
                    <Button
                      onClick={() => {
                        const onboardingUrl = getOnboardingUrl();
                        const message = `🎉 Join me on Lover's Code!

Session code: ${sessionId}

📱 How to join:

✨ NEW USERS:
1. Go to: ${onboardingUrl}
2. Click "Sign Up" to create your free account
3. Choose a username, enter your email, and create a password
4. Once logged in, navigate to Multiplayer
5. Click "Join Session" and enter the session code: ${sessionId}
6. Start chatting! 💕

👋 EXISTING USERS:
1. Go to: ${onboardingUrl}
2. Click "Sign In" and enter your credentials
3. Navigate to Multiplayer
4. Click "Join Session" and enter the session code: ${sessionId}
5. Start chatting! 💕

Let's connect and have fun together! 🎉`;
                        navigator.clipboard.writeText(message).then(() => {
                          toast.success('Invitation copied! Paste it in Snapchat to share.');
                          // Try to open Snapchat web
                          window.open('https://web.snapchat.com/', '_blank');
                        }).catch(() => {
                          toast.error('Failed to copy. Please copy the session code manually.');
                        });
                      }}
                      className="w-full bg-[#FFFC00] hover:bg-[#FFE500] text-black font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.031c-.012.111-.02.22-.02.31 0 .293.24.534.534.534.11 0 .208-.04.283-.105a.888.888 0 0 0 .224-.38c.279-.78.77-1.317 1.453-1.69.884-.48 1.89-.577 2.87-.577 1.98 0 3.91.88 4.89 2.41.77 1.2.9 2.69.35 4.05-.55 1.35-1.68 2.31-3.12 2.71-.3.09-.62.14-.94.14a4.5 4.5 0 0 1-2.25-.6c-.15-.09-.32-.14-.5-.14-.2 0-.38.06-.53.16l-2.34 1.58c-.36.24-.81.24-1.17 0l-2.34-1.58a.96.96 0 0 0-.53-.16c-.18 0-.35.05-.5.14a4.5 4.5 0 0 1-2.25.6c-.32 0-.64-.05-.94-.14-1.44-.4-2.57-1.36-3.12-2.71-.55-1.36-.42-2.85.35-4.05.98-1.53 2.91-2.41 4.89-2.41.98 0 1.99.1 2.87.58.68.37 1.17.9 1.45 1.69.03.08.08.16.13.24.05.08.1.15.15.21.08.1.18.18.3.24.12.06.25.1.38.1.29 0 .53-.24.53-.53 0-.09-.01-.2-.02-.31l-.003-.03c-.1-1.63-.23-3.66.3-4.85C8.13 1.07 11.22.8 12.21.8zm-1.36 7.99c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      Snapchat
                    </Button>
                    
                    <Button
                      onClick={() => {
                        const onboardingUrl = getOnboardingUrl();
                        const message = encodeURIComponent(`🎉 Join me on Lover's Code!\n\nSession code: ${sessionId}\n\n📱 How to join:\n\n✨ NEW USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign Up" to create your free account\n3. Choose a username, enter your email, and create a password\n4. Once logged in, navigate to Multiplayer\n5. Click "Join Session" and enter the session code: ${sessionId}\n6. Start chatting! 💕\n\n👋 EXISTING USERS:\n1. Go to: ${onboardingUrl}\n2. Click "Sign In" and enter your credentials\n3. Navigate to Multiplayer\n4. Click "Join Session" and enter the session code: ${sessionId}\n5. Start chatting! 💕\n\nLet's connect and have fun together! 🎉`);
                        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(onboardingUrl)}&quote=${message}`, '_blank');
                      }}
                      className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Mobile Hamburger Menu */}
        <HamburgerMenu 
          currentPage="multiplayer" 
          sessionId={sessionId}
          onCopySessionId={copySessionId}
        />
      </div>

      {/* Chat Messages - Only this area scrolls */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-0"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          paddingBottom: '200px' // Space for fixed input area
        }}
      >
        {messages.length === 0 && (
          <div className="text-center py-6 sm:py-8 text-gray-500">
            <Users className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm sm:text-base">No messages yet. Start the conversation!</p>
          </div>
        )}
        {messages.map((msg, idx) => {
          const currentPlayerName = playerName || user?.username || "Anonymous";
          const isOwnMessage = msg.sender === "You" || msg.sender === currentPlayerName;
          const isSystemMessage = msg.sender === "System";
          
          return (
            <div key={idx} className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs sm:max-w-sm lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${
                isOwnMessage 
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white" 
                  : isSystemMessage
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-center"
                  : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              }`}>
                {!isSystemMessage && (
                  <p className="text-xs font-medium opacity-80 mb-1">
                    {isOwnMessage ? currentPlayerName : msg.sender}
                  </p>
                )}
                {msg.type === 'image' && (msg.imageData || msg.imageUrl) ? (
                  <div className="space-y-2">
                    <img 
                      src={msg.imageData || msg.imageUrl || ''} 
                      alt="Shared image" 
                      className="max-w-full h-auto rounded-lg"
                      style={{ maxHeight: '300px' }}
                    />
                    {msg.text && msg.text !== '📷 Image' && (
                      <p className="text-xs sm:text-sm">{msg.text}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm">{msg.text}</p>
                )}
                <p className="text-xs opacity-70 mt-1">
                  {msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString() : new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Truth or Dare Dialog */}
      <Dialog open={showTruthOrDare} onOpenChange={setShowTruthOrDare}>
        <DialogContent className="w-[95vw] sm:w-[90vw] md:w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-2 sm:p-4 md:p-6 mx-2 sm:mx-4">
          <DialogHeader className="pb-1 sm:pb-2 md:pb-4">
            <DialogTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
              <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 flex-shrink-0" />
              <span>Truth or Dare</span>
            </DialogTitle>
          </DialogHeader>
          <div className="w-full overflow-x-hidden">
            <TruthOrDareSpinner 
              socket={socketRef.current}
              sessionId={sessionId}
              playerName={playerName}
              multiplayer={isInSession && isConnected}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Truth or Dare Result Popup (fades away) */}
      {truthOrDareResult && (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center pointer-events-none transition-opacity duration-500 ${showTruthOrDarePopup ? 'opacity-100' : 'opacity-0'}`}>
          <Card className="max-w-md mx-4 bg-gradient-to-br from-purple-500 to-pink-500 text-white border-2 border-purple-300 shadow-2xl pointer-events-auto animate-in fade-in zoom-in duration-300">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Crown className="h-6 w-6" />
                <h3 className="text-xl font-bold">
                  {truthOrDareResult.type === 'truth' ? 'Truth' : 'Dare'}
                </h3>
                <Crown className="h-6 w-6" />
              </div>
              <p className="text-lg mb-2 font-semibold">{truthOrDareResult.playerName} spun:</p>
              <p className="text-base mb-3 bg-white/20 rounded-lg p-3 backdrop-blur-sm">{truthOrDareResult.content}</p>
              <Badge className={`${
                truthOrDareResult.difficulty === 'easy' ? 'bg-green-500' :
                truthOrDareResult.difficulty === 'medium' ? 'bg-yellow-500' :
                'bg-red-500'
              } text-white`}>
                {truthOrDareResult.difficulty}
              </Badge>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Message Input - Fixed at bottom with iOS safe area support */}
      <div 
        className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 z-50"
        style={{ 
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
          paddingLeft: 'max(env(safe-area-inset-left), 0px)',
          paddingRight: 'max(env(safe-area-inset-right), 0px)',
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          backgroundColor: 'rgb(255, 255, 255)'
        }}
      >
        <div className="p-2 sm:p-3">
        <form onSubmit={handleSendMessage} className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          {/* Action buttons - wrap on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isConnected || isUploadingImage}
              className="border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
              title="Send image"
            >
              {isUploadingImage ? (
                <div className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-purple-500 border-t-transparent rounded-full" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTruthOrDare(true)}
              disabled={!isConnected}
              className="border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
              title="Truth or Dare"
            >
              <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
            <Popover open={showNumberSelector} onOpenChange={setShowNumberSelector}>
              <PopoverTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
                  disabled={!isConnected}
                >
                  <Hash className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[90vw] max-w-[320px] h-[60vh] max-h-[400px] overflow-y-auto p-2" side="top" align="start">
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-1">
                  {Array.from({ length: 400 }, (_, i) => (
                    <Button
                      key={i + 1}
                      variant="outline"
                      size="sm"
                      onClick={() => askQuestion(i + 1)}
                      className="text-[10px] sm:text-xs border-purple-200 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20 p-1 min-h-[32px] sm:min-h-[36px]"
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation"
                  disabled={!isConnected}
                >
                  <Smile className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[90vw] max-w-[320px] p-2" side="top" align="start">
                <div className="max-h-[200px] sm:max-h-[240px] overflow-y-auto overflow-x-hidden">
                  <div className="grid grid-cols-5 gap-1 sm:gap-2">
                    {emojis.map((emoji, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        size="sm"
                        onClick={() => sendEmoji(emoji)}
                        className="text-lg sm:text-2xl hover:bg-purple-100 dark:hover:bg-purple-900 p-1 sm:p-2 aspect-square h-auto w-full min-h-[36px] sm:min-h-[48px]"
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Input and Send button - full width on mobile */}
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto flex-1 min-w-0">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={!isConnected ? "Connecting..." : !partnerOnline ? "Waiting..." : "Type a message..."}
              className="flex-1 border-purple-300 focus:border-purple-500 text-sm min-w-0 text-base sm:text-sm"
              disabled={!isConnected}
              style={{ fontSize: '16px' }}
              onFocus={(e) => {
                // Scroll input into view on iOS when keyboard appears
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
            />
            <Button 
              type="submit" 
              disabled={!messageInput.trim() || !isConnected || isSendingMessage}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-2.5 sm:px-4 transition-all duration-200 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none touch-manipulation flex-shrink-0 min-h-[44px] sm:min-h-[40px]"
            >
              {isSendingMessage ? (
                <div className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </Button>
          </div>
        </form>
        </div>
        {/* Bottom text element - visible on all screen sizes */}
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center italic px-2 pb-2 pt-1 block">
          "Connection is the bridge between two hearts, built one message at a time."
        </p>
      </div>

      {/* Name Dialog for Anonymous Users */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Your Name</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Please enter your name to join the session. This will be visible to other players.
            </p>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name..."
              className="border-purple-300 focus:border-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && playerName.trim()) {
                  handleNameSubmit();
                }
              }}
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowNameDialog(false)}
                className="flex-1 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleNameSubmit}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                disabled={!playerName.trim()}
              >
                Join Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Question for you</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">{currentQuestion}</p>
            <Input
              value={questionAnswer}
              onChange={(e) => setQuestionAnswer(e.target.value)}
              placeholder="Your answer..."
              className="border-purple-300 focus:border-purple-500"
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowQuestionDialog(false)}
                className="flex-1 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
              >
                Skip
              </Button>
              <Button 
                onClick={handleQuestionAnswer}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                disabled={!questionAnswer.trim()}
              >
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Named Session Dialog */}
      <Dialog open={showCreateNamedSession} onOpenChange={setShowCreateNamedSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Named Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Give your session a memorable name that others can find and join.
            </p>
            <Input
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
              placeholder="Enter session name (e.g., 'Friday Night Chat', 'Study Group')"
              className="border-purple-300 focus:border-purple-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && sessionTitle.trim() && !isCreatingSession) {
                  createNamedSession();
                }
              }}
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateNamedSession(false);
                  setSessionTitle("");
                }}
                className="flex-1 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
                disabled={isCreatingSession}
              >
                Cancel
              </Button>
              <Button 
                onClick={createNamedSession}
                className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                disabled={!sessionTitle.trim() || isCreatingSession}
                loading={isCreatingSession}
                loadingText="Creating..."
              >
                Create Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Browse Sessions Dialog */}
      <Dialog open={showSessionBrowser} onOpenChange={setShowSessionBrowser}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Browse Available Sessions</DialogTitle>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Join an existing session or create your own
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {isLoadingSessions ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Loading sessions...</p>
              </div>
            ) : availableSessions.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="text-gray-600 dark:text-gray-400">No active sessions found</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Create a new session to get started!</p>
              </div>
            ) : (
              availableSessions.map((session) => (
                <div
                  key={session.session_id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors cursor-pointer"
                  onClick={() => joinSessionFromList(session.session_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {session.title || 'Untitled Session'}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {session.session_id}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {session.currentParticipants || 0} participant(s)
                        </span>
                      </div>
                      {session.created_at && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Created {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        joinSessionFromList(session.session_id);
                      }}
                      className="ml-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                    >
                      Join
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => {
                setShowSessionBrowser(false);
                setAvailableSessions([]);
              }}
              className="flex-1 border-purple-300 hover:bg-purple-50 dark:border-purple-700 dark:hover:bg-purple-900/20"
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                await loadAvailableSessions();
              }}
              className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              disabled={isLoadingSessions}
            >
              <Hash className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MultiplayerPage;