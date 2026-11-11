export interface Event {
  title: string;
  image: string;
  slug: string;
  location: string;
  date: string;
  time: string;
}

export const events: Event[] = [
  {
    title: "React Conf 2026",
    image: "/images/event1.png",
    slug: "react-conf-2026",
    location: "San Francisco, CA",
    date: "2026-11-18",
    time: "09:00 AM",
  },
  {
    title: "NodeConf EU 2026",
    image: "/images/event2.png",
    slug: "nodeconf-eu-2026",
    location: "Tallinn, Estonia",
    date: "2026-11-25",
    time: "10:00 AM",
  },
  {
    title: "PyCon US 2027",
    image: "/images/event3.png",
    slug: "pycon-us-2027",
    location: "Salt Lake City, UT",
    date: "2027-05-13",
    time: "08:30 AM",
  },
  {
    title: "HackMIT 2027",
    image: "/images/event4.png",
    slug: "hackmit-2027",
    location: "Cambridge, MA",
    date: "2027-02-26",
    time: "06:00 PM",
  },
  {
    title: "AWS re:Invent 2026",
    image: "/images/event5.png",
    slug: "aws-reinvent-2026",
    location: "Las Vegas, NV",
    date: "2026-11-30",
    time: "09:00 AM",
  },
  {
    title: "JSConf Asia 2027",
    image: "/images/event6.png",
    slug: "jsconf-asia-2027",
    location: "Singapore",
    date: "2027-04-08",
    time: "09:30 AM",
  },
];
