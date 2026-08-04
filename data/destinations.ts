export type Destination = {
  id: string;
  name: string;
  nameZh: string;
  chineseName: string;
  description: string;
  descriptionZh: string;
  image: string;
  size: "large" | "small";
  itinerary: {
    region: { zh: string; en: string };
    routeOrder: number;
    overnight: { zh: string; en: string };
  };
};

export const destinations: Destination[] = [
  {
    id: "huangguoshu-waterfall",
    name: "Huangguoshu Waterfall",
    nameZh: "黄果树瀑布",
    chineseName: "黄果树瀑布",
    description: "Water in its most spectacular form.",
    descriptionZh: "水，以最壮观的方式出现。",
    image:
      "/images/guizhou/huangguoshu.png",
    size: "large",
    itinerary: { region: { zh: "安顺与西部贵州", en: "Anshun and western Guizhou" }, routeOrder: 1, overnight: { zh: "黄果树或安顺", en: "Huangguoshu or Anshun" } },
  },
  {
    id: "xijiang-miao-village",
    name: "Xijiang Miao Village",
    nameZh: "西江千户苗寨",
    chineseName: "西江千户苗寨",
    description: "Mountain homes, warm lights, living culture.",
    descriptionZh: "山间人家、温暖灯火与仍在发生的文化。",
    image:
      "/images/guizhou/xijiang-miao-village.png",
    size: "small",
    itinerary: { region: { zh: "黔东南苗寨", en: "Southeast Guizhou villages" }, routeOrder: 3, overnight: { zh: "西江或凯里", en: "Xijiang or Kaili" } },
  },
  {
    id: "libo-xiaoqikong",
    name: "Libo Xiaoqikong",
    nameZh: "荔波小七孔",
    chineseName: "荔波小七孔",
    description: "A green ribbon of water through the forest.",
    descriptionZh: "穿行森林的一条碧绿水带。",
    image:
      "/images/guizhou/libo-xiaoqikong.png",
    size: "small",
    itinerary: { region: { zh: "荔波与南部贵州", en: "Libo and southern Guizhou" }, routeOrder: 2, overnight: { zh: "荔波", en: "Libo" } },
  },
  {
    id: "fanjing-mountain",
    name: "Fanjing Mountain",
    nameZh: "梵净山",
    chineseName: "梵净山",
    description: "Clouds, cliffs and a sense of elevation.",
    descriptionZh: "云雾、峭壁，以及不断向上的心境。",
    image:
      "/images/guizhou/fanjing-mountain.png",
    size: "small",
    itinerary: { region: { zh: "铜仁与黔东北", en: "Tongren and northeast Guizhou" }, routeOrder: 4, overnight: { zh: "铜仁或梵净山周边", en: "Tongren or near Fanjing Mountain" } },
  },
];
