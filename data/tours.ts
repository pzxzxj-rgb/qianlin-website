export type Tour = {
  title: string;
  titleZh: string;
  duration: string;
  durationZh: string;
  description: string;
  descriptionZh: string;
  price: string;
  image: string;
  tag: string;
  tagZh: string;
};

export const tours: Tour[] = [
  {
    title: "Guizhou Classic Tour",
    titleZh: "贵州经典之旅",
    duration: "5 Days",
    durationZh: "5天",
    description: "The essential Guizhou journey, from waterfalls to old towns.",
    descriptionZh: "从瀑布到古镇，走一遍贵州最值得抵达的风景。",
    price: "From ¥1,999",
    tag: "Best seller",
    tagZh: "热门推荐",
    image:
      "/images/hero/hero-01.webp",
  },
  {
    title: "Huangguoshu Waterfall Tour",
    titleZh: "黄果树瀑布之旅",
    duration: "3 Days",
    durationZh: "3天",
    description: "Feel the power of Asia's great waterfall in a relaxed escape.",
    descriptionZh: "在从容的旅程里，感受亚洲大瀑布的磅礴力量。",
    price: "From ¥1,299",
    tag: "Nature",
    tagZh: "自然",
    image:
      "/images/hero/hero-03.webp",
  },
  {
    title: "Xijiang Miao Village Experience",
    titleZh: "西江千户苗寨体验",
    duration: "3 Days",
    durationZh: "3天",
    description: "A thoughtful introduction to mountain villages and local life.",
    descriptionZh: "走进山间村寨，感受真实而温暖的当地生活。",
    price: "From ¥1,499",
    tag: "Culture",
    tagZh: "人文",
    image:
      "/images/hero/hero-04.webp",
  },
  {
    title: "Libo Xiaoqikong Nature Tour",
    titleZh: "荔波小七孔自然之旅",
    duration: "3 Days",
    durationZh: "3天",
    description: "Clear streams, forest trails and the quiet beauty of Libo.",
    descriptionZh: "清澈溪流、森林步道，以及荔波安静而丰沛的绿色。",
    price: "From ¥1,599",
    tag: "Slow travel",
    tagZh: "慢旅行",
    image:
      "/images/hero/hero-05.webp",
  },
  {
    title: "Fanjing Mountain Adventure",
    titleZh: "梵净山山野探险",
    duration: "4 Days",
    durationZh: "4天",
    description: "A scenic mountain route for curious walkers and photographers.",
    descriptionZh: "为热爱行走与摄影的人，准备一条穿行云雾的山路。",
    price: "From ¥1,799",
    tag: "Adventure",
    tagZh: "探险",
    image:
      "/images/hero/hero-02.webp",
  },
  {
    title: "Guizhou Deep Exploration",
    titleZh: "贵州深度探索",
    duration: "7 Days",
    durationZh: "7天",
    description: "Go deeper into the landscapes, flavors and stories of the province.",
    descriptionZh: "深入贵州的山水、风味与故事，慢慢认识这片土地。",
    price: "From ¥2,699",
    tag: "Signature",
    tagZh: "深度体验",
    image:
      "/images/hero/hero-05.webp",
  },
];
