export type Destination = {
  name: string;
  nameZh: string;
  chineseName: string;
  description: string;
  descriptionZh: string;
  image: string;
  size: "large" | "small";
};

export const destinations: Destination[] = [
  {
    name: "Huangguoshu Waterfall",
    nameZh: "黄果树瀑布",
    chineseName: "黄果树瀑布",
    description: "Water in its most spectacular form.",
    descriptionZh: "水，以最壮观的方式出现。",
    image:
      "https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1200&q=85",
    size: "large",
  },
  {
    name: "Xijiang Miao Village",
    nameZh: "西江千户苗寨",
    chineseName: "西江千户苗寨",
    description: "Mountain homes, warm lights, living culture.",
    descriptionZh: "山间人家、温暖灯火与仍在发生的文化。",
    image:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1000&q=85",
    size: "small",
  },
  {
    name: "Libo Xiaoqikong",
    nameZh: "荔波小七孔",
    chineseName: "荔波小七孔",
    description: "A green ribbon of water through the forest.",
    descriptionZh: "穿行森林的一条碧绿水带。",
    image:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85",
    size: "small",
  },
  {
    name: "Fanjing Mountain",
    nameZh: "梵净山",
    chineseName: "梵净山",
    description: "Clouds, cliffs and a sense of elevation.",
    descriptionZh: "云雾、峭壁，以及不断向上的心境。",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1000&q=85",
    size: "small",
  },
  {
    name: "Qingyan Ancient Town",
    nameZh: "青岩古镇",
    chineseName: "青岩古镇",
    description: "Stone lanes and slow afternoons.",
    descriptionZh: "石巷深处，是慢下来的午后。",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1000&q=85",
    size: "small",
  },
  {
    name: "Zhenyuan Ancient Town",
    nameZh: "镇远古城",
    chineseName: "镇远古城",
    description: "A river town shaped by time.",
    descriptionZh: "一座被时间与河流共同塑造的古城。",
    image:
      "https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1000&q=85",
    size: "large",
  },
];
