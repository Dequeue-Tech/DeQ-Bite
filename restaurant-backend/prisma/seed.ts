/// <reference types="node" />
import { PrismaClient, UserRole, RestaurantRole, SpiceLevel, OnboardingStatus, CouponType, OfferType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type RestaurantSeedConfig = {
  subdomain: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  cuisineTypes: string[];
  ownerEmail: string;
  categories: Array<{ name: string; description?: string }>;
  menuItems: Array<{
    name: string;
    description?: string;
    price: number;
    categoryName: string;
    isVeg: boolean;
    spiceLevel: SpiceLevel;
    image?: string;
  }>;
  popularDishes: string[];
  tables: Array<{ number: number; capacity: number; location?: string }>;
  coupons: Array<{
    code: string;
    type: CouponType;
    value: number;
    minOrderPaise?: number;
    maxDiscountPaise?: number;
    active?: boolean;
  }>;
  offers: Array<{
    name: string;
    description?: string;
    discountType: 'PERCENT' | 'FIXED';
    value: number;
    minOrderPaise?: number;
    maxDiscountPaise?: number;
    type?: OfferType;
    active?: boolean;
  }>;
};

const HAVELI_MENU_DATA = [
    {
      name: "Chinese Non-Veg",
      isVeg: false,
      image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=1000",
      items: [
        {
          name: "Chicken Hakka Noodles",
          price: 279,
          desc: "Classic wok-tossed noodles with chicken strips and veggies.",
          prep: 15,
          ingredients: ["Noodles", "Chicken", "Soy Sauce", "Cabbage"],
          allergens: ["Gluten", "Soy"],
          image: "https://curlytales.com/wp-content/uploads/2022/07/Untitled-design-2022-07-26T164509.714-1280x720.jpg"
        },
        {
          name: "Mix Hakka Noodles",
          price: 289,
          desc: "A protein-packed noodle dish with chicken, egg, and seafood.",
          prep: 18,
          ingredients: ["Noodles", "Chicken", "Egg", "Shrimp"],
          allergens: ["Gluten", "Soy", "Egg", "Shellfish"],
          image: ""
        },
        {
          name: "Chicken Schezwan Hakka Noodle",
          price: 269,
          desc: "Spicy stir-fried noodles with chicken in a fiery Schezwan base.",
          prep: 15,
          ingredients: ["Noodles", "Chicken", "Schezwan Sauce", "Dry Red Chilli"],
          allergens: ["Gluten", "Soy"],
          image: "https://sinfullyspicy.com/wp-content/uploads/2023/01/1200-by-1200-images-5.jpg"
        },
        {
          name: "Egg Hakka Noodles",
          price: 219,
          desc: "Simple and flavorful noodles tossed with scrambled eggs.",
          prep: 12,
          ingredients: ["Noodles", "Egg", "Spring Onion", "Soy Sauce"],
          allergens: ["Gluten", "Soy", "Egg"],
          image: "https://www.kannammacooks.com/wp-content/uploads/stir-fried-egg-hakka-noodles-1-2.jpg"
        },
        {
          name: "Egg Schezwan Hakka Noodles",
          price: 279,
          desc: "Noodles with egg tossed in a pungent Schezwan sauce.",
          prep: 15,
          ingredients: ["Noodles", "Egg", "Szechuan Pepper", "Garlic"],
          allergens: ["Gluten", "Soy", "Egg"],
          image: ""
        },
        {
          name: "Chicken Garlic Hakka Noodles",
          price: 269,
          desc: "Noodles infused with a strong punch of roasted garlic and chicken.",
          prep: 15,
          ingredients: ["Noodles", "Chicken", "Minced Garlic", "Celery"],
          allergens: ["Gluten", "Soy"],
          image: ""
        },
        {
          name: "Chicken Shanghai Noodles",
          price: 289,
          desc: "Thick savory noodles in a dark soy and ginger chicken base.",
          prep: 18,
          ingredients: ["Noodles", "Chicken", "Dark Soy", "Ginger"],
          allergens: ["Gluten", "Soy"],
          image: ""
        },
        {
          name: "Chicken Manchurian",
          price: 359,
          desc: "Golden fried chicken balls in a thick ginger-garlic soy gravy.",
          prep: 20,
          ingredients: ["Chicken", "Corn Flour", "Ginger", "Garlic", "Soy"],
          allergens: ["Soy", "Gluten"],
          image: "https://www.chilitochoc.com/wp-content/uploads/2024/11/serving-spoon-in-manchurian-gravy.jpg"
        },
        {
          name: "Chicken Chilli Bone",
          price: 339,
          desc: "Bone-in chicken sautéed with fresh green chillies and bell peppers.",
          prep: 20,
          ingredients: ["Chicken with Bone", "Capsicum", "Onion", "Green Chilli"],
          allergens: ["Soy", "Gluten"],
          image: ""
        },
        {
          name: "Chicken Chilli Boneless",
          price: 349,
          desc: "Tender boneless chicken stir-fried in a spicy chilli soy glaze.",
          prep: 18,
          ingredients: ["Chicken Boneless", "Bell Pepper", "Soy Sauce", "Vinegar"],
          allergens: ["Soy", "Gluten"],
          image: "https://englishmeatempire.com/wp-content/uploads/2025/03/chiclli-chicken.jpg"
        },
        {
          name: "Chicken Salt & Pepper",
          price: 329,
          desc: "Dry-fried crunchy chicken seasoned with sea salt and cracked pepper.",
          prep: 15,
          ingredients: ["Chicken", "Black Pepper", "Spring Onion", "Salt"],
          allergens: ["Gluten"],
          image: "https://christieathome.com/wp-content/uploads/2023/12/salt-and-pepper-chicken9.jpg"
        },
        {
          name: "Chicken Schezwan (Dry/Gravy/Semi)",
          price: 359,
          desc: "Succulent chicken cooked in a hot and spicy Schezwan base.",
          prep: 20,
          ingredients: ["Chicken", "Schezwan Sauce", "Celery", "Garlic"],
          allergens: ["Soy", "Gluten"],
          image: ""
        },
        {
          name: "Chicken Garlic (Gravy/Semi)",
          price: 349,
          desc: "Chicken pieces simmered in a rich, garlic-heavy aromatic sauce.",
          prep: 20,
          ingredients: ["Chicken", "Garlic Paste", "Soy Sauce", "Onion"],
          allergens: ["Soy", "Gluten"],
          image: ""
        },
        {
          name: "Ginger Chicken (Semi/Gravy/Latpt)",
          price: 339,
          desc: "Chicken tossed with fresh julienned ginger and savory spices.",
          prep: 20,
          ingredients: ["Chicken", "Fresh Ginger", "Green Onion", "Soy Sauce"],
          allergens: ["Soy", "Gluten"],
          image: ""
        },
        {
          name: "Chicken Lolipop",
          price: 359,
          desc: "Frenched chicken wings deep-fried and served with hot garlic sauce.",
          prep: 22,
          ingredients: ["Chicken Wings", "Ginger-Garlic Paste", "Chilli Powder"],
          allergens: ["Gluten", "Egg"],
          image: "https://b.zmtcdn.com/data/dish_photos/3e3/79ec9956c1a054b54936e85bc242a3e3.jpeg"
        },
        {
          name: "Drums of Heaven Chicken",
          price: 369,
          desc: "Fried chicken wings tossed in a sweet and spicy Schezwan glaze.",
          prep: 22,
          ingredients: ["Chicken Wings", "Honey", "Schezwan Sauce", "Garlic"],
          allergens: ["Gluten", "Soy"],
          image: "https://b.zmtcdn.com/data/dish_photos/678/5b8459c83e5d896750075c8057cee678.jpg"
        },
        {
          name: "Chicken Pan Fry Noodles",
          price: 289,
          desc: "Crispy-bottomed noodles topped with a savory chicken-veg sauce.",
          prep: 20,
          ingredients: ["Noodles", "Chicken", "Corn Starch", "Mix Veg"],
          allergens: ["Gluten", "Soy"],
          image: ""
        },
        {
          name: "Chicken Spring Roll",
          price: 289,
          desc: "Crispy fried rolls stuffed with seasoned chicken and veggies.",
          prep: 15,
          ingredients: ["Flour Wrap", "Chicken", "Cabbage", "Carrot"],
          allergens: ["Gluten", "Soy"],
          image: "https://www.munatycooking.com/wp-content/uploads/2022/06/Chicken-Spring-Rolls-feature-image-500x500.jpg"
        },
        {
          name: "Chicken 65",
          price: 349,
          desc: "Spicy South-Indian style deep-fried chicken tempered with curry leaves.",
          prep: 18,
          ingredients: ["Chicken", "Rice Flour", "Curry Leaves", "Yogurt"],
          allergens: ["Gluten", "Dairy"],
          image: "https://paattiskitchen.com/wp-content/uploads/2023/05/kmc_20230501_131310.jpg"
        }
      ]
    },
    {
      name: "Chinese Veg",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1512058560366-cd2429598a6a?q=80&w=1000",
      items: [
        { name: "Veg Hakka Noodle", price: 219, desc: "Simple stir-fried noodles with farm-fresh garden vegetables.", prep: 12, ingredients: ["Noodles", "Carrot", "Beans", "Cabbage"], allergens: ["Gluten", "Soy"], image: "https://www.whiskaffair.com/wp-content/uploads/2020/10/Veg-Hakka-Noodles-2-3.jpg" },
        { name: "Veg Mix Chowmein", price: 259, desc: "A blend of noodles and crunchy assorted veggies in savory spices.", prep: 15, ingredients: ["Noodles", "Mix Veg", "Soy Sauce", "MSG-free spice"], allergens: ["Gluten", "Soy"], image: "" },
        { name: "Mushroom Chowmein", price: 209, desc: "Earthy mushrooms and noodles tossed in a high-flame wok.", prep: 15, ingredients: ["Noodles", "Button Mushrooms", "Garlic", "Onion"], allergens: ["Gluten", "Soy"], image: "https://www.vegrecipesofindia.com/wp-content/uploads/2021/08/mushroom-noodles-3.jpg" },
        { name: "Schezwan Hakka Noodles", price: 215, desc: "Veggie noodles tossed in a fiery, homemade Schezwan sauce.", prep: 15, ingredients: ["Noodles", "Dried Chilli", "Garlic", "Bell Pepper"], allergens: ["Gluten", "Soy"], image: "https://www.cookwithmanali.com/wp-content/uploads/2021/08/Schezwan-Noodles-500x500.jpg" },
        { name: "Garlic Hakka Noodles", price: 219, desc: "Noodles featuring a heavy punch of roasted golden garlic.", prep: 12, ingredients: ["Noodles", "Garlic", "Celery", "Spring Onion"], allergens: ["Gluten", "Soy"], image: "" },
        { name: "Shanghai Noodles", price: 201, desc: "Veggies and noodles cooked in a sweet-savory traditional style.", prep: 15, ingredients: ["Noodles", "Dark Soy", "Cabbage", "Vinegar"], allergens: ["Gluten", "Soy"], image: "" },
        { name: "Veg Manchurian", price: 269, desc: "Vegetable dumplings in a spicy, ginger-garlic soy-based gravy.", prep: 20, ingredients: ["Mix Veg Balls", "Soy Sauce", "Ginger", "Garlic"], allergens: ["Gluten", "Soy"], image: "https://holycowvegan.net/wp-content/uploads/2020/03/veg-manchurian-7.jpg" },
        { name: "Veg Chilli Dry", price: 259, desc: "Stir-fried assorted veggies tossed in a spicy green chilli glaze.", prep: 18, ingredients: ["Mix Veg", "Capsicum", "Soy", "Green Chilli"], allergens: ["Soy", "Gluten"], image: "" },
        { name: "Corn Salt & Pepper", price: 289, desc: "Crispy fried corn kernels seasoned with simple salt and pepper.", prep: 15, ingredients: ["Sweet Corn", "Black Pepper", "Corn Flour"], allergens: ["Corn"], image: "https://www.kolkataweb.com/wp-content/uploads/2023/02/CHOWMAN18American-Corn-Pepper-Salt.jpg" },
        { name: "Mushroom Salt & Pepper", price: 279, desc: "Lightly battered mushrooms seasoned with cracked peppercorns.", prep: 15, ingredients: ["Mushrooms", "Black Pepper", "Flour"], allergens: ["Gluten"], image: "" },
        { name: "Mushroom Chilli", price: 289, desc: "Mushrooms sautéed with capsicum and spicy chilli sauce.", prep: 18, ingredients: ["Mushrooms", "Onion", "Capsicum", "Chilli"], allergens: ["Soy", "Gluten"], image: "https://www.foodsala.com/wp-content/uploads/2024/01/chilli-mushroom-dry-or-gravy-1-e1646051565586.jpeg" },
        { name: "Paneer Chilli", price: 285, desc: "Fresh cottage cheese cubes tossed in a hot and tangy chilli base.", prep: 18, ingredients: ["Paneer", "Capsicum", "Soy Sauce", "Chillies"], allergens: ["Dairy", "Soy", "Gluten"], image: "https://www.funfoodfrolic.com/wp-content/uploads/2020/04/Chilli-Paneer-Thumbnail.jpg" },
        { name: "Paneer Salt & Pepper", price: 299, desc: "Crispy paneer cubes seasoned with salt and freshly ground pepper.", prep: 15, ingredients: ["Paneer", "Pepper", "Corn Starch"], allergens: ["Dairy", "Gluten"], image: "" },
        { name: "Paneer Schezwan Dry", price: 259, desc: "Paneer chunks prepared in a hot and pungent Schezwan base.", prep: 18, ingredients: ["Paneer", "Schezwan Pepper", "Garlic"], allergens: ["Dairy", "Soy", "Gluten"], image: "" },
        { name: "Potato Chilli", price: 259, desc: "Crispy potato wedges tossed with onions and spicy chilli sauce.", prep: 15, ingredients: ["Potato", "Onion", "Soy Sauce", "Green Chilli"], allergens: ["Soy", "Gluten"], image: "" },
        { name: "Honey Chilli Potato", price: 269, desc: "Crispy potatoes glazed with a sweet and spicy honey chilli sauce.", prep: 15, ingredients: ["Potato", "Honey", "Chilli Flakes", "Sesame"], allergens: ["Soy", "Gluten", "Sesame"], image: "https://static.toiimg.com/thumb/52532656.cms?imgsize=498654&width=800&height=800" },
        { name: "French Fry", price: 210, desc: "Classic golden deep-fried salted potato strips.", prep: 10, ingredients: ["Potato", "Salt", "Oil"], allergens: [], image: "https://www.awesomecuisine.com/wp-content/uploads/2009/05/french-fries.jpg" },
        { name: "Chana Chilli", price: 279, desc: "Boiled chickpeas sautéed with spices and a spicy chilli glaze.", prep: 15, ingredients: ["Chickpeas", "Soy Sauce", "Onion", "Chilli"], allergens: ["Soy", "Gluten"], image: "" },
        { name: "Paneer 65", price: 309, desc: "Spicy deep-fried paneer bites tempered with fresh curry leaves.", prep: 18, ingredients: ["Paneer", "Rice Flour", "Spices", "Curry Leaves"], allergens: ["Dairy", "Gluten"], image: "" },
        { name: "Cheese Chilli (Haveli Dhaba Special)", price: 399, desc: "Signature rich dish of melted cheese and spicy green chillies.", prep: 20, ingredients: ["Processed Cheese", "Paneer", "Green Chilli", "Garlic"], allergens: ["Dairy", "Soy", "Gluten"], image: "" },
        { name: "Baby Corn Chilli", price: 299, desc: "Crunchy baby corn tossed in a hot and tangy chilli soy sauce.", prep: 15, ingredients: ["Baby Corn", "Capsicum", "Onion", "Soy"], allergens: ["Soy", "Gluten"], image: "https://foodmahal.in/wp-content/uploads/2024/10/22-scaled.jpg" },
        { name: "Baby Corn Salt & Pepper", price: 289, desc: "Fried baby corn pieces seasoned with sea salt and cracked pepper.", prep: 15, ingredients: ["Baby Corn", "Black Pepper", "Flour"], allergens: ["Gluten"], image: "" },
        { name: "Pan Fry Noodles", price: 280, desc: "Noodles pan-fried until crispy, served with a light veggie sauce.", prep: 20, ingredients: ["Noodles", "Mix Veg", "Soy Sauce"], allergens: ["Gluten", "Soy"], image: "" },
        { name: "Veg Spring Roll", price: 281, desc: "Crispy rolls filled with shredded seasonal vegetables and spices.", prep: 15, ingredients: ["Flour Sheet", "Cabbage", "Carrot", "Capsicum"], allergens: ["Gluten", "Soy"], image: "https://www.kitchensanctuary.com/wp-content/uploads/2023/10/Vegetable-Spring-Rolls-square-FS.jpg" },
      ]
    },
    {
      name: "Tandoor Veg",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1599487488170-d11ec9c175f0?q=80&w=1000",
      items: [
        {
          name: "Paneer Tikka",
          price: 298,
          desc: "Tandoori-grilled paneer cubes marinated in yogurt and spices.",
          prep: 20,
          ingredients: ["Paneer", "Yogurt", "Ginger-Garlic", "Spices"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/477/fd34d2df6530fc486e19ef5f617de477.jpg"
        },
        {
          name: "Veg Hara Bhara Kabab",
          price: 315,
          desc: "Nutritious green kababs made with spinach, peas, and potatoes.",
          prep: 15,
          ingredients: ["Spinach", "Green Peas", "Potato", "Breadcrumbs"],
          allergens: ["Gluten", "Dairy"],
          image: "https://www.cookclickndevour.com/wp-content/uploads/2016/05/hara-bhara-kabab-recipe-1-480x270.jpg"
        },
        {
          name: "Mushroom Tikka",
          price: 289,
          desc: "Fresh button mushrooms marinated and grilled in a clay oven.",
          prep: 15,
          ingredients: ["Mushrooms", "Yogurt", "Tandoori Masala"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Veg Seek Kabab",
          price: 279,
          desc: "Skewered minced vegetables seasoned with herbs and grilled.",
          prep: 18,
          ingredients: ["Minced Veg", "Potatoes", "Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Paneer Malai Tikka",
          price: 349,
          desc: "Mildly spiced paneer cubes in a rich, creamy white marinade.",
          prep: 22,
          ingredients: ["Paneer", "Fresh Cream", "Cheese", "Cardamom"],
          allergens: ["Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Veg Platter",
          price: 399,
          desc: "Assorted tandoori starters perfect for a group sampling.",
          prep: 25,
          ingredients: ["Paneer", "Mushroom", "Veg Kabab", "Soya"],
          allergens: ["Dairy", "Gluten", "Soy"],
          image: ""
        },
        {
          name: "Baby Corn Tikka",
          price: 289,
          desc: "Baby corn marinated in tandoori spices and char-grilled.",
          prep: 15,
          ingredients: ["Baby Corn", "Yogurt", "Besan", "Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Paneer Aachari Tikka",
          price: 359,
          desc: "Paneer cubes marinated in a tangy pickling (achari) spice blend.",
          prep: 20,
          ingredients: ["Paneer", "Pickle Spices", "Mustard Oil", "Yogurt"],
          allergens: ["Dairy", "Mustard"],
          image: "https://b.zmtcdn.com/data/dish_photos/9ed/7db4e2aa85d9f7f41b872cc7840749ed.jpg"
        },
        {
          name: "Paneer Haryali Tikka",
          price: 389,
          desc: "Cottage cheese chunks in a fresh mint and coriander marinade.",
          prep: 20,
          ingredients: ["Paneer", "Mint", "Coriander", "Green Chilli"],
          allergens: ["Dairy"],
          image: "https://media-cdn.tripadvisor.com/media/photo-s/13/2b/00/57/hariyali-paneer-tikka.jpg"
        },
        {
          name: "Paneer Mushroom Tikka",
          price: 322,
          desc: "Skewered combination of paneer and mushrooms grilled together.",
          prep: 20,
          ingredients: ["Paneer", "Mushrooms", "Yogurt", "Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Soya Afghani Chap",
          price: 299,
          desc: "Soya chunks in a rich, creamy Afghani style white marinade.",
          prep: 20,
          ingredients: ["Soya Chap", "Cream", "Cashew Paste", "Yogurt"],
          allergens: ["Dairy", "Soy", "Nuts"],
          image: "https://images.herzindagi.info/image/2024/Jun/best-afghani-chaap-recipe.jpg"
        },
        {
          name: "Soya Aachari Chap",
          price: 319,
          desc: "Tangy soya chunks marinated in a spicy pickling spice mix.",
          prep: 20,
          ingredients: ["Soya Chap", "Pickle Paste", "Mustard Oil"],
          allergens: ["Dairy", "Soy", "Mustard"],
          image: "https://5.imimg.com/data5/SELLER/Default/2023/8/339786032/GB/BP/VE/164404726/screenshot-2023-08-31-at-23-23-13.png"
        },
        {
          name: "Soya Malai Chap",
          price: 349,
          desc: "Soft soya chunks marinated in a delicate cream and cardamom blend.",
          prep: 22,
          ingredients: ["Soya Chap", "Malai", "Cheese", "Cardamom"],
          allergens: ["Dairy", "Soy"],
          image: ""
        }
      ]
    },
    {
      name: "Tandoor Non-Veg",
      isVeg: false,
      image: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?q=80&w=1000",
      items: [
        {
          name: "Tandoori Chicken (8 ps / 4 ps)",
          price: 589,
          desc: "Whole chicken marinated in spices and yogurt, grilled in tandoor.",
          prep: 30,
          ingredients: ["Whole Chicken", "Yogurt", "Kashmiri Chilli", "Lemon"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/ec5/9b050bea8aadce56bbf0b25bc4048ec5.jpg"
        },
        {
          name: "Chicken Tikka (10 ps)",
          price: 389,
          desc: "Boneless chicken chunks grilled to a smoky, spicy finish.",
          prep: 20,
          ingredients: ["Chicken Boneless", "Yogurt", "Mustard Oil", "Spices"],
          allergens: ["Dairy", "Mustard"],
          image: "https://i.ytimg.com/vi/pt2Q5Wbz1dU/maxresdefault.jpg"
        },
        {
          name: "Chicken Malai Tikka (10 ps)",
          price: 399,
          desc: "Melt-in-mouth chicken pieces in a creamy, mild white marinade.",
          prep: 22,
          ingredients: ["Chicken", "Cream", "Cheese", "Cardamom"],
          allergens: ["Dairy", "Nuts"],
          image: "https://www.awesomecuisine.com/wp-content/uploads/2012/11/Chicken-Malai-Tikka.jpg"
        },
        {
          name: "Chicken Seek Kabab (8 ps)",
          price: 389,
          desc: "Skewered minced chicken seasoned with fresh cilantro and spices.",
          prep: 18,
          ingredients: ["Minced Chicken", "Coriander", "Ginger-Garlic", "Spices"],
          allergens: ["Dairy"],
          image: "https://derafarms.com/cdn/shop/files/deraproducts-2024-06-12T110804.251.png?v=1719207183"
        },
        {
          name: "Chicken Lahsuni Tikka (10 ps)",
          price: 385,
          desc: "Tandoori chicken chunks flavored heavily with roasted garlic.",
          prep: 20,
          ingredients: ["Chicken", "Roasted Garlic", "Yogurt", "Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Chicken Kali Mirch Tikka (10 ps)",
          price: 399,
          desc: "Chicken pieces seasoned with pungent crushed black peppercorns.",
          prep: 20,
          ingredients: ["Chicken", "Black Pepper", "Yogurt", "Cream"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Chicken Boti Kabab (10 ps)",
          price: 399,
          desc: "Traditional boneless chicken pieces grilled to smoky perfection.",
          prep: 20,
          ingredients: ["Chicken Boti", "Yogurt", "Dhaba Masala"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Pahadi Kabab (10 ps)",
          price: 389,
          desc: "Fresh green kabab flavored with mint, coriander, and green chillies.",
          prep: 20,
          ingredients: ["Chicken", "Mint Paste", "Coriander", "Yogurt"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Chicken Haryali Kabab (10 ps)",
          price: 385,
          desc: "Chicken chunks in a fresh cilantro and herb marinade.",
          prep: 20,
          ingredients: ["Chicken", "Spinach", "Mint", "Yogurt"],
          allergens: ["Dairy"],
          image: "https://www.lekhafoods.com/media/202086/chicken-hariyali-kebab.jpg"
        },
        {
          name: "Chicken Reshmi Kabab (8 ps)",
          price: 395,
          desc: "Chicken kebabs with a silky, 'reshmi' (silken) texture.",
          prep: 22,
          ingredients: ["Chicken", "Egg White", "Cream", "Spices"],
          allergens: ["Dairy", "Egg"],
          image: ""
        },
        {
          name: "Chicken Afghani Kabab (Bone 8 ps/4 ps)",
          price: 589,
          desc: "Rich and mildly spiced bone-in chicken in Afghani marinade.",
          prep: 30,
          ingredients: ["Chicken", "Cashew Paste", "Cream", "Melon Seeds"],
          allergens: ["Dairy", "Nuts"],
          image: "https://socialchefpriyanka.com/wp-content/uploads/2019/10/afghani-chicken-cooktube.jpg"
        },
        {
          name: "Chicken Platter",
          price: 499,
          desc: "A premium assortment of Haveli Dhaba's best chicken kababs.",
          prep: 35,
          ingredients: ["Chicken Tikka", "Malai Tikka", "Seek Kabab", "Haryali"],
          allergens: ["Dairy", "Nuts", "Egg"],
          image: ""
        },
        {
          name: "Kali Mirch Tandoori with Bone (8 ps/4 ps)",
          price: 599,
          desc: "Bone-in chicken seasoned with bold black pepper and grilled.",
          prep: 30,
          ingredients: ["Chicken", "Crushed Pepper", "Yogurt", "Ghee"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Haveli Dhaba Special Kabab (Bone Less 10 ps)",
          price: 499,
          desc: "Chef's special boneless kebab with a unique spice blend.",
          prep: 25,
          ingredients: ["Chicken", "Secret Dhaba Spices", "Lemon", "Ginger"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Haveli Dhaba Special Kabab (Bone 8 ps)",
          price: 599,
          desc: "Our signature bone-in chicken preparation, a house specialty.",
          prep: 30,
          ingredients: ["Chicken", "Traditional Dhaba Spices", "Mustard Oil"],
          allergens: ["Dairy", "Mustard"],
          image: ""
        }
      ]
    },
    {
      name: "Indian Bread",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?q=80&w=1000",
      items: [
        {
          name: "Tandoori Roti Plain",
          price: 30,
          desc: "Wheat flour bread baked in a traditional clay oven.",
          prep: 8,
          ingredients: ["Whole Wheat Flour", "Water"],
          allergens: ["Gluten"],
          image: "https://inredberry.com/wp-content/uploads/2023/10/Tandoori-Roti.png"
        },
        {
          name: "Tandoori Roti Butter",
          price: 35,
          desc: "Tandoori roti brushed with golden yellow butter.",
          prep: 8,
          ingredients: ["Whole Wheat Flour", "Butter"],
          allergens: ["Gluten", "Dairy"],
          image: "https://mughaldarbar.in/upload/pro/product-featured-90.jpg"
        },
        {
          name: "Tawa Roti Plain",
          price: 22,
          desc: "Hand-rolled wheat flatbread cooked on a griddle.",
          prep: 5,
          ingredients: ["Whole Wheat Flour"],
          allergens: ["Gluten"],
          image: ""
        },
        {
          name: "Tawa Roti Butter",
          price: 30,
          desc: "Wheat tawa roti topped with melted butter.",
          prep: 5,
          ingredients: ["Whole Wheat Flour", "Butter"],
          allergens: ["Gluten", "Dairy"],
          image: ""
        },
        {
          name: "Plain Naan",
          price: 60,
          desc: "Soft, leavened white flour bread baked in tandoor.",
          prep: 10,
          ingredients: ["Refined Flour", "Yeast", "Milk"],
          allergens: ["Gluten", "Dairy"],
          image: ""
        },
        {
          name: "Butter Naan",
          price: 80,
          desc: "Soft naan topped with a generous amount of butter.",
          prep: 10,
          ingredients: ["Refined Flour", "Butter", "Milk"],
          allergens: ["Gluten", "Dairy"],
          image: "https://foodess.com/wp-content/uploads/2023/02/Butter-Naan-2.jpg"
        },
        {
          name: "Masala Kulcha",
          price: 79,
          desc: "Leavened bread stuffed with spicy potato and onion mix.",
          prep: 12,
          ingredients: ["Flour", "Potato", "Onion", "Amchur"],
          allergens: ["Gluten", "Dairy"],
          image: "https://www.faskitchen.com/wp-content/uploads/2016/03/Masala-Kulcha-recipe-how-to-make-masala-kulcha.jpg"
        },
        {
          name: "Garlic Naan",
          price: 89,
          desc: "Naan topped with chopped garlic and coriander leaves.",
          prep: 12,
          ingredients: ["Flour", "Minced Garlic", "Coriander", "Butter"],
          allergens: ["Gluten", "Dairy"],
          image: "https://www.pachakam.com/wp-content/uploads/2009/05/new-butter-naan-500x500.jpg"
        },
        {
          name: "Missi Roti",
          price: 60,
          desc: "Spiced chickpea flour and wheat bread with fenugreek.",
          prep: 10,
          ingredients: ["Besan", "Wheat Flour", "Fenugreek", "Cumin"],
          allergens: ["Gluten"],
          image: "https://i0.wp.com/spicechronicles.com/wp-content/uploads/2012/02/Missy_1.jpg?resize=640%2C640&ssl=1"
        },
        {
          name: "Aloo Paratha",
          price: 60,
          desc: "Wheat flatbread stuffed with mashed seasoned potatoes.",
          prep: 15,
          ingredients: ["Wheat Flour", "Potato", "Green Chilli", "Ghee"],
          allergens: ["Gluten", "Dairy"],
          image: ""
        },
        {
          name: "Paneer Kulcha",
          price: 80,
          desc: "Bread stuffed with spiced crumbled cottage cheese.",
          prep: 15,
          ingredients: ["Flour", "Paneer", "Spices", "Coriander"],
          allergens: ["Gluten", "Dairy"],
          image: ""
        },
        {
          name: "Shahi Naan",
          price: 95,
          desc: "Royal naan topped with dry fruits and nuts.",
          prep: 15,
          ingredients: ["Flour", "Cashews", "Raisins", "Butter"],
          allergens: ["Gluten", "Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Plain Kulcha",
          price: 60,
          desc: "Unstuffed soft leavened bread baked in tandoor.",
          prep: 10,
          ingredients: ["Flour", "Milk", "Yeast"],
          allergens: ["Gluten", "Dairy"],
          image: "https://www.yummytummyaarthi.com/wp-content/uploads/2014/10/1-30.jpg"
        },
        {
          name: "Cheese Naan",
          price: 85,
          desc: "Naan bread stuffed with melted cheese.",
          prep: 15,
          ingredients: ["Flour", "Processed Cheese", "Butter"],
          allergens: ["Gluten", "Dairy"],
          image: ""
        }
      ]
    },
    {
      name: "Soup Veg",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1547592115-0dec33f78d7a?q=80&w=1000",
      items: [
        {
          name: "Veg Manchow Soup",
          price: 189,
          desc: "Spicy and thick Indo-Chinese soup served with crispy noodles.",
          prep: 12,
          ingredients: ["Vegetable Broth", "Cabbage", "Soy", "Crispy Noodles"],
          allergens: ["Soy", "Gluten"],
          image: "https://i0.wp.com/aartimadan.com/wp-content/uploads/2021/01/Veg-Manchow-Soup.jpg?fit=1000%2C561&ssl=1"
        },
        {
          name: "Veg Hot & Sour Soup",
          price: 179,
          desc: "Tangy and spicy broth with assorted vegetables and mushrooms.",
          prep: 12,
          ingredients: ["Mix Veg", "Vinegar", "Chilli Sauce", "Soy"],
          allergens: ["Soy"],
          image: "https://skydecklounge.in/wp-content/uploads/2022/01/Hot-and-Sour-Veg-Soup.jpg"
        },
        {
          name: "Lemon Garlic Veg Soup",
          price: 155,
          desc: "Light vegetable soup with zesty lemon and roasted garlic.",
          prep: 10,
          ingredients: ["Clear Broth", "Lemon Juice", "Garlic", "Coriander"],
          allergens: [],
          image: ""
        },
        {
          name: "Veg Coriander Soup",
          price: 149,
          desc: "Refreshing clear soup with plenty of fresh cilantro.",
          prep: 10,
          ingredients: ["Veg Stock", "Coriander", "Ginger", "Lemon"],
          allergens: [],
          image: ""
        },
        {
          name: "Sweet Corn Soup",
          price: 169,
          desc: "Creamy soup with sweet corn kernels and mild spices.",
          prep: 12,
          ingredients: ["Sweet Corn", "Cream", "Veg Stock"],
          allergens: ["Corn"],
          image: "https://media.sailusfood.com/wp-content/uploads/2012/02/sweet-corn-soup.jpg"
        },
        {
          name: "Veg Clear Soup",
          price: 145,
          desc: "Healthy transparent broth with steamed seasonal vegetables.",
          prep: 10,
          ingredients: ["Water", "Carrot", "Beans", "Salt"],
          allergens: [],
          image: ""
        },
        {
          name: "Tomato Soup",
          price: 160,
          desc: "Classic soup made from slow-cooked fresh tomatoes.",
          prep: 10,
          ingredients: ["Tomato", "Cream", "Herbs"],
          allergens: ["Dairy"],
          image: "https://www.tasteofhome.com/wp-content/uploads/2025/03/EXPS_TOHVP24_132607_MF_08_27_1.jpg"
        },
        {
          name: "Cream of Tomato Soup",
          price: 165,
          desc: "Smooth tomato soup enriched with butter and cream.",
          prep: 12,
          ingredients: ["Tomato", "Fresh Cream", "Butter"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Cream of Musroom Soup",
          price: 189,
          desc: "Thick mushroom puree blended with fresh cream.",
          prep: 15,
          ingredients: ["Mushrooms", "Cream", "Butter", "Black Pepper"],
          allergens: ["Dairy"],
          image: "https://encrypted-tbn2.gstatic.com/images?q=tbn:ANd9GcRlgWcWz8yboR2IDLVhZXqEFvCIVmrCNlGHh0Nbb1fFnAnHie0UipWKfxThezQW"
        }
      ]
    },
    {
      name: "Soup Non-Veg",
      isVeg: false,
      image: "https://images.unsplash.com/photo-1547592115-0dec33f78d7a?q=80&w=1000",
      items: [
        {
          name: "Chicken Manchow Soup",
          price: 189,
          desc: "Spicy thick soup with chicken bits and fried noodles.",
          prep: 15,
          ingredients: ["Chicken Stock", "Chicken Bits", "Soy Sauce", "Noodles"],
          allergens: ["Soy", "Gluten", "Egg"],
          image: ""
        },
        {
          name: "Chicken Hot & Soup Sour",
          price: 185,
          desc: "Spicy chicken soup with a tangy finish and egg drops.",
          prep: 15,
          ingredients: ["Chicken", "Egg", "Soy", "Chilli Sauce"],
          allergens: ["Soy", "Egg"],
          image: ""
        },
        {
          name: "Chicken Lemon Garlic Soup",
          price: 179,
          desc: "Zesty chicken soup flavored with lemon and roasted garlic.",
          prep: 12,
          ingredients: ["Chicken Stock", "Garlic", "Lemon", "Chicken pieces"],
          allergens: [],
          image: ""
        },
        {
          name: "Chicken Soup Coriander",
          price: 175,
          desc: "Chicken clear soup infused with fresh coriander leaves.",
          prep: 12,
          ingredients: ["Chicken Stock", "Coriander", "Ginger"],
          allergens: [],
          image: ""
        },
        {
          name: "Chicken Sweet Corn Soup",
          price: 180,
          desc: "Creamy soup with shredded chicken and sweet corn kernels.",
          prep: 15,
          ingredients: ["Chicken", "Sweet Corn", "Cream"],
          allergens: ["Corn"],
          image: ""
        },
        {
          name: "Chicken Clear Soup",
          price: 170,
          desc: "Simple chicken broth with clear flavors and lean chicken pieces.",
          prep: 12,
          ingredients: ["Chicken", "Onion", "Black Pepper"],
          allergens: [],
          image: "https://sugarfreelondoner.com/wp-content/uploads/2023/11/clear-chicken-soup-in-bowl.jpg"
        }
      ]
    },
    {
      name: "Indian Veg Main Course",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=1000",
      items: [
        { name: "Paneer Tikka Masala", price: 389, desc: "Grilled paneer tikka chunks simmered in a spiced masala gravy.", prep: 20, ingredients: ["Grilled Paneer", "Tomato", "Onion", "Cream"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Tikka Butter Masala", price: 399, desc: "Smoky paneer tikka in a rich, buttery and creamy tomato sauce.", prep: 22, ingredients: ["Paneer Tikka", "Butter", "Cream", "Cashew Paste"], allergens: ["Dairy", "Nuts"], image: "https://static.toiimg.com/photo/54408184.cms" },
        { name: "Paneer Masala", price: 379, desc: "Paneer cooked in a traditional Indian spiced onion-tomato base.", prep: 18, ingredients: ["Paneer", "Onion", "Tomato", "Spices"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Butter Masala", price: 385, desc: "Soft paneer in a silky smooth, mildly sweet buttery gravy.", prep: 20, ingredients: ["Paneer", "Butter", "Cream", "Honey"], allergens: ["Dairy", "Nuts"], image: "https://b.zmtcdn.com/data/dish_photos/c84/5b0c32090aa42a8a1f5adcde167a5c84.jpg" },
        { name: "Kadhai Paneer", price: 378, desc: "Paneer tossed with capsicum and fresh ground spices in a wok.", prep: 20, ingredients: ["Paneer", "Bell Peppers", "Kadhai Masala"], allergens: ["Dairy"], image: "https://b.zmtcdn.com/data/dish_photos/822/7aee1bcbc2de150964f7da62354ee822.jpg" },
        { name: "Paneer Keema", price: 349, desc: "Minced paneer cooked with green peas and aromatic spices.", prep: 18, ingredients: ["Minced Paneer", "Green Peas", "Tomato", "Spices"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Do Pyaza", price: 385, desc: "Paneer cooked with twice the amount of onions in a thick gravy.", prep: 20, ingredients: ["Paneer", "Diced Onions", "Fried Onions", "Tomato"], allergens: ["Dairy"], image: "https://b.zmtcdn.com/data/dish_photos/2ef/438179a189948a87fff17935c01532ef.jpg" },
        { name: "Matar Paneer", price: 369, desc: "Homestyle curry made with cottage cheese and sweet green peas.", prep: 18, ingredients: ["Paneer", "Green Peas", "Indian Curry Base"], allergens: ["Dairy"], image: "" },
        { name: "Shahi Paneer", price: 399, desc: "Royal paneer dish prepared in a luscious white cashew gravy.", prep: 22, ingredients: ["Paneer", "Cashew Cream", "Cardamom", "Saffron"], allergens: ["Dairy", "Nuts"], image: "https://madhurasrecipe.com/wp-content/uploads/2022/01/shahi_paneer_featured.jpg" },
        { name: "Paneer Methi Malai", price: 379, desc: "Paneer in a fragrant cream sauce flavored with fenugreek leaves.", prep: 22, ingredients: ["Paneer", "Fresh Fenugreek", "Cream", "Garlic"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Mushroom Masala", price: 399, desc: "Hearty combination of paneer and mushrooms in a spicy gravy.", prep: 20, ingredients: ["Paneer", "Mushroom", "Onion-Tomato Masala"], allergens: ["Dairy"], image: "" },
        { name: "Palak Paneer", price: 381, desc: "Healthy dish of paneer cubes in a smooth spinach puree.", prep: 18, ingredients: ["Paneer", "Spinach", "Cream", "Ginger"], allergens: ["Dairy"], image: "https://www.indianveggiedelight.com/wp-content/uploads/2017/10/palak-paneer-recipe-featured.jpg" },
        { name: "Palak Paneer Lehsuni", price: 369, desc: "Spinach paneer with a heavy tempering of roasted garlic.", prep: 20, ingredients: ["Paneer", "Spinach", "Garlic bits", "Ghee"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Chatpata", price: 380, desc: "Paneer cooked in a tangy, spicy and uniquely flavored sauce.", prep: 20, ingredients: ["Paneer", "Tamarind", "Chilli", "Jaggery"], allergens: ["Dairy"], image: "" },
        { name: "Paneer Shahi Kofta", price: 390, desc: "Royal paneer dumplings served in a rich and velvety gravy.", prep: 25, ingredients: ["Paneer Balls", "Cream", "Cashew Sauce", "Butter"], allergens: ["Dairy", "Nuts", "Gluten"], image: "" },
        { name: "Mushroom Chatpata", price: 349, desc: "Mushrooms sautéed in a tangy and spicy tomato-based sauce.", prep: 18, ingredients: ["Mushrooms", "Lemon Juice", "Chilli", "Coriander"], allergens: [], image: "" },
        { name: "Mushroom Do Pyaza", price: 359, desc: "Mushrooms prepared with a double portion of sautéed onions.", prep: 18, ingredients: ["Mushrooms", "Onion Bulbs", "Spices"], allergens: [], image: "https://b.zmtcdn.com/data/dish_photos/a87/15385d94ccb1425d53479873f7711a87.jpg" },
        { name: "Mushroom Masala", price: 385, desc: "Fresh button mushrooms cooked in a thick spicy Indian gravy.", prep: 18, ingredients: ["Mushrooms", "Onion", "Tomato Masala"], allergens: [], image: "" },
        { name: "Mushroom Kadhai", price: 389, desc: "Mushrooms tossed with bell peppers and ground kadhai spices.", prep: 20, ingredients: ["Mushrooms", "Capsicum", "Spices"], allergens: [], image: "https://b.zmtcdn.com/data/dish_photos/804/b5e2c5119ff166382119291c70f3b804.jpg" },
        { name: "Corn Mushroom Masala", price: 379, desc: "Sweet corn and mushrooms in a rich and flavorful gravy.", prep: 20, ingredients: ["Sweet Corn", "Mushrooms", "Onion Base"], allergens: ["Corn"], image: "" },
        { name: "Matar Mushroom", price: 369, desc: "Earthy mushrooms and green peas in a comforting curry.", prep: 18, ingredients: ["Mushrooms", "Peas", "Tomato Masala"], allergens: [], image: "" },
        { name: "Mushroom Hyderabadi", price: 375, desc: "Mushrooms cooked in a spicy, spinach-based Hyderabadi style.", prep: 20, ingredients: ["Mushrooms", "Spinach", "Green Chilli"], allergens: [], image: "" },
        { name: "Mix Veg", price: 299, desc: "Assorted seasonal vegetables cooked in a blend of Indian spices.", prep: 18, ingredients: ["Carrot", "Beans", "Peas", "Potato", "Paneer"], allergens: ["Dairy"], image: "https://b.zmtcdn.com/data/dish_photos/d2a/474ba243e33e7ee6cab44e2cc2d8dd2a.jpg" },
        { name: "Veg Kadhai", price: 369, desc: "Mixed vegetables tossed with fresh spices in a traditional wok.", prep: 20, ingredients: ["Assorted Veg", "Kadhai Masala"], allergens: [], image: "" },
        { name: "Veg Do Pyaza", price: 379, desc: "Mixed vegetables prepared with plenty of caramelized onions.", prep: 20, ingredients: ["Mix Veg", "Onions", "Spices"], allergens: [], image: "" },
        { name: "Tawa Veg", price: 359, desc: "Seasonal vegetables stir-fried on a flat griddle with spices.", prep: 15, ingredients: ["Veggies", "Griddle Spices"], allergens: [], image: "" },
        { name: "Aloo Gobi Matar", price: 269, desc: "Classic trio of potato, cauliflower, and green peas.", prep: 15, ingredients: ["Potato", "Cauliflower", "Peas"], allergens: [], image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcScDnB07on_-UZs_Uov3iH-lXctePs91BUO8A&s" },
        { name: "Aloo Dam Kashmiri", price: 259, desc: "Fried whole baby potatoes in a sweet-spicy Kashmiri gravy.", prep: 20, ingredients: ["Potato", "Saffron", "Dry Ginger", "Fennel"], allergens: [], image: "https://b.zmtcdn.com/data/dish_photos/3e9/7eea75ed4b34e2510235277ca46363e9.jpg" },
        { name: "Aloo Matar", price: 255, desc: "Simple homestyle potato and pea curry.", prep: 15, ingredients: ["Potato", "Green Peas", "Cumin"], allergens: [], image: "" },
        { name: "Baby Corn Masala", price: 369, desc: "Tender baby corn pieces sautéed in a thick tomato-based sauce.", prep: 18, ingredients: ["Baby Corn", "Tomato", "Ginger-Garlic"], allergens: [], image: "" },
        { name: "Palak Corn Lehsuni", price: 295, desc: "Smooth spinach puree with sweet corn and heavy garlic tempering.", prep: 18, ingredients: ["Spinach", "Sweet Corn", "Fried Garlic"], allergens: ["Corn"], image: "" },
        { name: "Soya Chap Masala", price: 349, desc: "Meaty soya chunks cooked in a thick and spicy masala gravy.", prep: 20, ingredients: ["Soya Chap", "Tomato", "Onion", "Ghee"], allergens: ["Soy", "Dairy"], image: "https://www.funfoodfrolic.com/wp-content/uploads/2022/08/Soya-Chaap-Blog.jpg" },
        { name: "Paneer Pakoda", price: 349, desc: "Fresh cottage cheese fritters fried to a golden crisp.", prep: 15, ingredients: ["Paneer", "Gram Flour", "Chilli"], allergens: ["Dairy"], image: "" },
        { name: "Onion Pakoda", price: 259, desc: "Spiced onion fritters, a perfect tea-time or starter snack.", prep: 15, ingredients: ["Onion", "Gram Flour", "Cumin"], allergens: [], image: "https://www.munatycooking.com/wp-content/uploads/2024/02/Onion-Pakora-4.jpg" },
        { name: "Navratan Korma", price: 289, desc: "Nine varieties of vegetables and fruits in a mild creamy sauce.", prep: 22, ingredients: ["Mix Veg", "Fruit bits", "Cream Sauce"], allergens: ["Dairy", "Nuts"], image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSMaWE4KCxxo_0dsTgy7G4Aurit0Lmom0E8SA&s" },
        { name: "Kaju Kadhai", price: 449, desc: "Roasted cashews cooked in a spicy kadhai gravy with capsicum.", prep: 22, ingredients: ["Cashews", "Capsicum", "Tomato", "Spices"], allergens: ["Nuts", "Dairy"], image: "" },
        { name: "Kaju Masala", price: 459, desc: "Whole cashews simmered in a rich and spicy tomato-onion base.", prep: 22, ingredients: ["Cashews", "Gravy Base", "Butter"], allergens: ["Nuts", "Dairy"], image: "" },
        { name: "Malai Kofta", price: 339, desc: "Paneer dumplings served in a silky smooth, nutty mild gravy.", prep: 25, ingredients: ["Paneer Balls", "Cream", "Cashew Gravy"], allergens: ["Dairy", "Nuts", "Gluten"], image: "" },
        { name: "Veg Kofta", price: 299, desc: "Mixed vegetable dumplings in a spicy Indian red gravy.", prep: 22, ingredients: ["Veg Balls", "Onion-Tomato Gravy"], allergens: ["Gluten"], image: "" },
        { name: "Nargis Kofta", price: 315, desc: "Vegetable dumplings stuffed with paneer in a rich gravy.", prep: 25, ingredients: ["Veg Shell", "Paneer Core", "Rich Sauce"], allergens: ["Dairy", "Gluten"], image: "" },
        { name: "Veg Akbari", price: 295, desc: "Assorted vegetables cooked in a royal, yellow spicy gravy.", prep: 20, ingredients: ["Mix Veg", "Turmeric Sauce", "Cream"], allergens: ["Dairy"], image: "" },
        { name: "Chana Masala", price: 289, desc: "Hearty chickpeas cooked in a robust blend of Indian spices.", prep: 15, ingredients: ["Chickpeas", "Tomato", "Coriander"], allergens: [], image: "https://sixhungryfeet.com/wp-content/uploads/2023/06/Easy-Chana-Masala-Recipe-8.jpg" },
        { name: "Punjabi Chana Masala", price: 295, desc: "Spicy dark chickpea curry prepared in traditional Punjabi style.", prep: 18, ingredients: ["Black Chana", "Tea leaves", "Ginger", "Amla"], allergens: [], image: "" },
      ]
    },
    {
      name: "Indian Non-Veg Main Course",
      isVeg: false,
      image: "https://images.unsplash.com/photo-1603894584134-f1746b3f309a?q=80&w=1000",
      items: [
        {
          name: "Chicken Curry (4 P/2 P)",
          price: 469,
          desc: "Standard home-style chicken curry with flavorful thin gravy.",
          prep: 25,
          ingredients: ["Chicken", "Onion", "Tomato Stock"],
          allergens: [],
          image: "https://www.spicebangla.com/wp-content/uploads/2024/10/Chicken-Curry-Recipe0.webp"
        },
        {
          name: "Chicken Handi (4 P/2 P)",
          price: 489,
          desc: "Chicken slow-cooked in a clay pot with traditional spices.",
          prep: 30,
          ingredients: ["Chicken", "Yogurt", "Clay Pot Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Chicken Do Pyaza (4P)",
          price: 465,
          desc: "Chicken chunks cooked with a double layer of sweet onions.",
          prep: 25,
          ingredients: ["Chicken", "Caramelized Onions", "Tomato"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/06e/1eb6f275fb449e9c01e3ba97cfc6d06e.jpg"
        },
        {
          name: "Chicken Kassa (4 Pis)",
          price: 479,
          desc: "A dry and spicy slow-roasted chicken preparation with thick gravy.",
          prep: 28,
          ingredients: ["Chicken", "Roasted Spices", "Mustard Oil"],
          allergens: ["Mustard"],
          image: ""
        },
        {
          name: "Chicken Butter Masala (4 P/2 P)",
          price: 499,
          desc: "Tandoori chicken pieces in a rich tomato and butter-based gravy.",
          prep: 28,
          ingredients: ["Chicken Tikka", "Butter", "Tomato Cream Sauce"],
          allergens: ["Dairy", "Nuts"],
          image: "https://b.zmtcdn.com/data/dish_photos/eb0/9e63fdf332b1f4171656fd9379c3deb0.jpg"
        },
        {
          name: "Chicken Masala (4 P)",
          price: 479,
          desc: "Chicken sautéed in a thick, aromatic onion-tomato masala base.",
          prep: 25,
          ingredients: ["Chicken", "Garam Masala", "Ginger-Garlic"],
          allergens: [],
          image: ""
        },
        {
          name: "Chicken Tikka Masala (8P)",
          price: 449,
          desc: "Grilled chicken tikka pieces simmered in a spicy masala gravy.",
          prep: 28,
          ingredients: ["Chicken Tikka", "Spicy Gravy"],
          allergens: ["Dairy"],
          image: "https://staging2.glebekitchen.com/wp-content/uploads/2017/04/chickentikkamasalafront.jpg"
        },
        {
          name: "Chicken Tikka Butter Masala (8 P)",
          price: 459,
          desc: "Tikka pieces in a silky, butter-enriched creamy tomato sauce.",
          prep: 28,
          ingredients: ["Chicken Tikka", "Butter", "Cashew Sauce"],
          allergens: ["Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Chicken Lawabdar (4P)",
          price: 489,
          desc: "Tender chicken in a mildly spicy and velvety creamy gravy.",
          prep: 28,
          ingredients: ["Chicken", "Cream", "Melon Seeds"],
          allergens: ["Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Chicken Lakhnawi (4 P)",
          price: 480,
          desc: "Slow-cooked chicken prepared with aromatic Lucknowi spices.",
          prep: 30,
          ingredients: ["Chicken", "Rose Water", "Mace", "Cardamom"],
          allergens: [],
          image: ""
        },
        {
          name: "Chicken Patiala Bone (4P)",
          price: 479,
          desc: "Spicy and tangy chicken curry prepared in traditional Patiala style.",
          prep: 30,
          ingredients: ["Chicken", "Omelette wrapper", "Spicy Sauce"],
          allergens: ["Egg"],
          image: ""
        },
        {
          name: "Chicken Patiala Boneless (8P)",
          price: 489,
          desc: "Boneless version of the spicy and tangy Patiala chicken curry.",
          prep: 30,
          ingredients: ["Chicken Boneless", "Spices", "Egg garnish"],
          allergens: ["Egg"],
          image: ""
        },
        {
          name: "Chicken Kadhai (4P)",
          price: 475,
          desc: "Chicken and capsicum stir-fried with fresh ground spices in a wok.",
          prep: 25,
          ingredients: ["Chicken", "Bell Peppers", "Kadhai Masala"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/64a/6a35fee9881db41860690ceeb5efc64a.jpg"
        },
        {
          name: "Chicken Kolhapuri (4 P)",
          price: 485,
          desc: "Fiery spicy chicken curry using traditional Kolhapuri chillies.",
          prep: 28,
          ingredients: ["Chicken", "Kolhapuri Masala", "Dry Coconut"],
          allergens: [],
          image: "https://theyummydelights.com/wp-content/uploads/2020/07/kolhapuri-chicken-curry-9.jpg"
        },
        {
          name: "Chicken Methi Malai (8 P)",
          price: 689,
          desc: "Rich chicken dish flavored with fenugreek and heavy cream.",
          prep: 30,
          ingredients: ["Chicken", "Fresh Fenugreek", "Cream", "Garlic"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Haveli Dhaba Special Chicken (8 P)",
          price: 699,
          desc: "Our house specialty rich chicken preparation with unique secret spices.",
          prep: 35,
          ingredients: ["Chicken", "House Spice Mix", "Ghee"],
          allergens: ["Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Tawa Chicken (4P)",
          price: 499,
          desc: "Succulent chicken cooked on a griddle with plenty of spices.",
          prep: 25,
          ingredients: ["Chicken", "Tomato", "Ginger", "Green Chilli"],
          allergens: [],
          image: ""
        },
        {
          name: "Chicken Bhuna Gosht (4P)",
          price: 489,
          desc: "Slow-roasted chicken in a dry, concentrated spice gravy.",
          prep: 30,
          ingredients: ["Chicken", "Roasted Onion Paste"],
          allergens: [],
          image: ""
        },
        {
          name: "Murg Masallam (8P/4P)",
          price: 699,
          desc: "Whole chicken roasted and served in a rich egg-enriched gravy.",
          prep: 40,
          ingredients: ["Whole Chicken", "Boiled Egg", "Cashew Sauce"],
          allergens: ["Dairy", "Nuts", "Egg"],
          image: "https://cookwithfaiza.net/wp-content/uploads/2024/04/451545740_Murgh_Musallam_Masala.jpeg"
        },
        {
          name: "Chicken Dehati",
          price: 689,
          desc: "Rustic village-style chicken curry with strong mustard oil flavor.",
          prep: 35,
          ingredients: ["Chicken", "Whole Spices", "Mustard Oil"],
          allergens: ["Mustard"],
          image: ""
        },
        {
          name: "Chicken Bharta",
          price: 449,
          desc: "Shredded chicken prepared in a rich and creamy egg-based gravy.",
          prep: 25,
          ingredients: ["Shredded Chicken", "Mashed Egg", "Cream"],
          allergens: ["Dairy", "Egg"],
          image: "https://i0.wp.com/spicechronicles.com/wp-content/uploads/2017/04/Chicken-Bhartha_2_650.jpg?resize=640%2C640&ssl=1"
        },
        {
          name: "Egg Curry (2P)",
          price: 219,
          desc: "Boiled eggs served in a flavorful onion-tomato based gravy.",
          prep: 15,
          ingredients: ["Boiled Egg", "Indian Sauce Base"],
          allergens: ["Egg"],
          image: "https://www.sharmispassions.com/wp-content/uploads/2013/02/EggMasala4-500x375.jpg"
        },
        {
          name: "Egg Masala (2P)",
          price: 222,
          desc: "Eggs cooked in a thick and spicy masala base.",
          prep: 15,
          ingredients: ["Egg", "Onion-Tomato Masala"],
          allergens: ["Egg"],
          image: ""
        },
        {
          name: "Egg Do Pyaza (2 P)",
          price: 229,
          desc: "Eggs prepared with a generous amount of sautéed onions.",
          prep: 18,
          ingredients: ["Egg", "Diced Onions"],
          allergens: ["Egg"],
          image: ""
        },
        {
          name: "Fish Curry (2P)",
          price: 269,
          desc: "Fresh fish pieces in a light and aromatic Indian fish gravy.",
          prep: 20,
          ingredients: ["Fish", "Mustard Paste", "Tamarind"],
          allergens: ["Fish", "Mustard"],
          image: "https://vismaifood.com/storage/app/uploads/public/daa/96d/7bc/thumb__1200_0_0_0_auto.jpg"
        },
        {
          name: "Fish Masala (2P)",
          price: 289,
          desc: "Spiced pan-fried fish pieces in a thick masala gravy.",
          prep: 22,
          ingredients: ["Fish", "Onion", "Tomato", "Garlic"],
          allergens: ["Fish"],
          image: ""
        },
        {
          name: "Fish Fry (2 P)",
          price: 199,
          desc: "Crispy deep-fried fish pieces marinated in traditional spices.",
          prep: 15,
          ingredients: ["Fish", "Gram Flour", "Chilli"],
          allergens: ["Fish"],
          image: "https://motionsandemotions.com/wp-content/uploads/2024/06/Untitled-design-_63_-_1_.webp"
        },
        {
          name: "Fish Do Pyaza (2 P)",
          price: 299,
          desc: "Fish chunks cooked with plenty of caramelized onions.",
          prep: 22,
          ingredients: ["Fish", "Onions", "Spices"],
          allergens: ["Fish"],
          image: ""
        },
        {
          name: "Mutton Curry (4P)",
          price: 599,
          desc: "Tender goat meat slow-cooked in a traditional Indian curry.",
          prep: 35,
          ingredients: ["Mutton", "Curry base"],
          allergens: [],
          image: ""
        },
        {
          name: "Mutton Dehati (8 P/4P)",
          price: 949,
          desc: "Classic rustic village-style mutton curry cooked on slow fire.",
          prep: 45,
          ingredients: ["Mutton", "Whole Garlic", "Mustard Oil"],
          allergens: ["Mustard"],
          image: "https://b.zmtcdn.com/data/dish_photos/558/6f8ecc70488eb2dc61b3b82b33fac558.jpg"
        },
        {
          name: "Mutton Kassa (4 P)",
          price: 579,
          desc: "Spicy dry-braised mutton dish with deep concentrated flavors.",
          prep: 40,
          ingredients: ["Mutton", "Roasted Onion", "Garam Masala"],
          allergens: [],
          image: ""
        },
        {
          name: "Mutton Rogan Josh (4P)",
          price: 589,
          desc: "Kashmiri-style mutton curry with a thin, vibrant red gravy.",
          prep: 40,
          ingredients: ["Mutton", "Ratan Jot", "Dry Ginger", "Fennel"],
          allergens: [],
          image: "https://www.whiskaffair.com/wp-content/uploads/2019/02/Mutton-Rogan-Josh-2-3.jpg"
        }
      ]
    },
    {
      name: "Rice & Biryani",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1563379091339-03b21bc4a6f8?q=80&w=1000",
      items: [
        {
          name: "Steamed Rice",
          price: 115,
          desc: "Classic long-grain steamed basmati rice.",
          prep: 10,
          ingredients: ["Basmati Rice"],
          allergens: [],
          image: "https://media.soscuisine.com/images/recettes/large/2887.jpg"
        },
        {
          name: "Jeera Rice",
          price: 129,
          desc: "Fragrant rice tempered with cumin seeds and ghee.",
          prep: 12,
          ingredients: ["Rice", "Cumin", "Ghee"],
          allergens: ["Dairy"],
          image: "https://www.cubesnjuliennes.com/wp-content/uploads/2019/04/Fried-Jeera-Rice-Recipe.jpg"
        },
        {
          name: "Veg Mix Pulao",
          price: 199,
          desc: "Aromatic basmati rice cooked with assorted vegetables.",
          prep: 15,
          ingredients: ["Rice", "Mix Veg", "Whole Spices"],
          allergens: [],
          image: "https://www.indianveggiedelight.com/wp-content/uploads/2019/07/veg-pulao-featured-500x500.jpg"
        },
        {
          name: "Peas Pulao",
          price: 159,
          desc: "Basmati rice cooked with sweet green peas and mild spices.",
          prep: 15,
          ingredients: ["Rice", "Green Peas", "Cumin"],
          allergens: [],
          image: ""
        },
        {
          name: "Kashmiri Pulao",
          price: 209,
          desc: "Sweet and aromatic rice cooked with dry fruits and nuts.",
          prep: 18,
          ingredients: ["Rice", "Raisins", "Cashews", "Fruits"],
          allergens: ["Nuts"],
          image: ""
        },
        {
          name: "Veg Biryani",
          price: 329,
          desc: "Fragrant rice layered with spiced vegetables and herbs.",
          prep: 25,
          ingredients: ["Rice", "Mix Veg", "Saffron", "Spices"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/4f5/a762a0f7008bdf1c1040fc443e4914f5.jpg"
        },
        {
          name: "Veg Hydrabadi Biryani",
          price: 339,
          desc: "Spicy Hyderabadi style biryani cooked with veggies.",
          prep: 25,
          ingredients: ["Rice", "Spicy Veg", "Fried Onions"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/1aa/923a0908713b01342cc5fab093be31aa.jpg"
        },
        {
          name: "Veg Kolhapuri Biryani",
          price: 349,
          desc: "Extra spicy biryani influenced by Kolhapuri flavors.",
          prep: 25,
          ingredients: ["Rice", "Kolhapuri Masala", "Veg"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/89d/33d52d9126e482e52c8567de4cd8589d.jpg"
        },
        {
          name: "Paneer Biryani",
          price: 329,
          desc: "Aromatic rice layered with spiced paneer cubes.",
          prep: 25,
          ingredients: ["Rice", "Paneer", "Dum spices"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/019/165615c4bceb204f0e467eeabd7da019.jpg"
        },
        {
          name: "Egg Biryani",
          price: 310,
          isVeg: false,
          desc: "Long-grain rice cooked with hard-boiled spiced eggs.",
          prep: 22,
          ingredients: ["Rice", "Boiled Eggs", "Biryani Masala"],
          allergens: ["Egg"],
          image: "https://www.chefkunalkapur.com/wp-content/uploads/2021/03/egg-biryani-1-1300x868.jpeg?v=1625193642"
        },
        {
          name: "Chicken Dum Biryani",
          price: 369,
          isVeg: false,
          desc: "Traditional slow-cooked chicken and rice preparation.",
          prep: 30,
          ingredients: ["Rice", "Chicken", "Kesar", "Dum Spices"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/3d0/fdf7c11867e101376407c6fe092703d0.jpg"
        },
        {
          name: "Chicken Hydrabadi Biryani",
          price: 379,
          isVeg: false,
          desc: "Authentic spicy Hyderabadi chicken biryani.",
          prep: 30,
          ingredients: ["Rice", "Spicy Chicken", "Hyderabadi Spices"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/3d0/fdf7c11867e101376407c6fe092703d0.jpg"
        },
        {
          name: "Chicken Kolkata Dum Biryani",
          price: 389,
          isVeg: false,
          desc: "Mildly spiced chicken biryani served with a potato.",
          prep: 30,
          ingredients: ["Rice", "Chicken", "Potato", "Sweet Spices"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/27a/1bc879c601d88457f2367db89d7c027a.jpg"
        },
        {
          name: "Mutton Dum Biryani",
          price: 399,
          isVeg: false,
          desc: "Slow-cooked rice and tender mutton layered together.",
          prep: 35,
          ingredients: ["Rice", "Mutton", "Nutmeg", "Saffron"],
          allergens: ["Dairy"],
          image: "https://b.zmtcdn.com/data/dish_photos/61f/776ed89331db48c5197ada7bd6ab061f.jpg"
        },
        {
          name: "Mutton Hydrabadi Biryani",
          price: 385,
          isVeg: false,
          desc: "Spicy Hyderabadi goat meat biryani.",
          prep: 35,
          ingredients: ["Rice", "Mutton", "Fried Onions", "Chilli"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Mutton Kolkata Dum Biryani",
          price: 389,
          isVeg: false,
          desc: "Kolkata style mutton biryani with potato and mild aroma.",
          prep: 35,
          ingredients: ["Rice", "Mutton", "Potato", "Rose Water"],
          allergens: ["Dairy"],
          image: ""
        }
      ]
    },
    {
      name: "Dal",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?q=80&w=1000",
      items: [
        {
          name: "Dal Fry",
          price: 199,
          desc: "Yellow lentils tempered with onions, tomatoes, and cumin.",
          prep: 12,
          ingredients: ["Tur Dal", "Cumin", "Onion", "Garlic"],
          allergens: [],
          image: "https://www.spiceupthecurry.com/wp-content/uploads/2022/07/dal-fry-2.jpg"
        },
        {
          name: "Dal Makhani",
          price: 239,
          desc: "Slow-cooked black lentils with cream and butter.",
          prep: 25,
          ingredients: ["Black Dal", "Kidney Beans", "Butter", "Cream"],
          allergens: ["Dairy"],
          image: "https://www.maggi.in//sites/default/files/srh_recipes/eb6c6566a4dc1e241ec7231984265d61.jpg"
        },
        {
          name: "Dal Tadka",
          price: 249,
          desc: "Lentils with a vibrant tempering of dried chillies and garlic.",
          prep: 12,
          ingredients: ["Toor Dal", "Dried Chilli", "Fried Garlic"],
          allergens: [],
          image: "https://vegecravings.com/wp-content/uploads/2018/01/Dal-Tadka-Recipe-Step-By-Step-Instructions.jpg"
        },
        {
          name: "Dal Amritsari",
          price: 259,
          desc: "Thick, split black gram lentils cooked in Amritsari style.",
          prep: 18,
          ingredients: ["Split Urad Dal", "Chana Dal", "Ginger"],
          allergens: ["Dairy"],
          image: "https://www.foodie-trail.com/wp-content/uploads/2023/02/20230221_193437244_iOS-scaled.jpg"
        },
        {
          name: "Dal Makkhan Wala",
          price: 255,
          desc: "Silky yellow lentils finished with a heavy hand of butter.",
          prep: 15,
          ingredients: ["Mixed Lentils", "Extra Butter"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Dal Handi",
          price: 245,
          desc: "Lentils slow-cooked in a handi with rich dhaba spices.",
          prep: 20,
          ingredients: ["Lentils", "Handi Spices"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Egg Dal Tadka",
          price: 265,
          isVeg: false,
          desc: "Spiced lentils with a unique tempering of scrambled eggs.",
          prep: 18,
          ingredients: ["Yellow Dal", "Egg", "Spices"],
          allergens: ["Egg"],
          image: "https://slurrp.club/wp-content/uploads/2020/03/DSC_1771-2.jpg"
        },
        {
          name: "Dal Do Pyaza",
          price: 249,
          desc: "Lentils cooked with a double portion of savory onions.",
          prep: 18,
          ingredients: ["Lentils", "Caramelized Onions"],
          allergens: [],
          image: ""
        }
      ]
    },
    {
      name: "Chinese Rice",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1603133872878-684f208fb84b?q=80&w=1000",
      items: [
        {
          name: "Egg Fried Rice",
          price: 229,
          isVeg: false,
          desc: "Indo-Chinese style fried rice with scrambled eggs.",
          prep: 12,
          ingredients: ["Rice", "Egg", "Soy Sauce"],
          allergens: ["Egg", "Soy"],
          image: "https://www.sharmispassions.com/wp-content/uploads/2013/04/EggFriedRice4-500x375.jpg"
        },
        {
          name: "Chicken Fried Rice",
          price: 259,
          isVeg: false,
          desc: "Wok-tossed fried rice with chicken bits and vegetables.",
          prep: 15,
          ingredients: ["Rice", "Chicken", "Soy Sauce"],
          allergens: ["Soy"],
          image: "https://b.zmtcdn.com/data/dish_photos/932/9d0726d5a5b408045363df03b57e2932.jpg"
        },
        {
          name: "Mix Fried Rice Non-Veg",
          price: 289,
          isVeg: false,
          desc: "Fried rice containing chicken, egg, and shrimp.",
          prep: 18,
          ingredients: ["Rice", "Chicken", "Egg", "Shrimp"],
          allergens: ["Egg", "Soy", "Shellfish"],
          image: "https://b.zmtcdn.com/data/dish_photos/c40/6e56bece39ca0676c945a240e1b9bc40.jpg"
        },
        {
          name: "Chicken Schezwan Fried Rice",
          price: 255,
          isVeg: false,
          desc: "Spicy fried rice with chicken in Schezwan sauce.",
          prep: 15,
          ingredients: ["Rice", "Chicken", "Schezwan Sauce"],
          allergens: ["Soy"],
          image: ""
        },
        {
          name: "Chicken Shanghai Fried Rice",
          price: 259,
          isVeg: false,
          desc: "Savory fried rice prepared with Shanghai style flavors.",
          prep: 18,
          ingredients: ["Rice", "Chicken", "Ginger", "Soy"],
          allergens: ["Soy"],
          image: ""
        },
        {
          name: "Veg Fried Rice",
          price: 189,
          desc: "Simple and clean fried rice with garden vegetables.",
          prep: 12,
          ingredients: ["Rice", "Mix Veg", "Soy"],
          allergens: ["Soy"],
          image: "https://b.zmtcdn.com/data/dish_photos/6af/ac687b1ab84d2505a589e41e358ca6af.jpg"
        },
        {
          name: "Mixed Veg Fried Rice",
          price: 249,
          desc: "Wok-tossed rice with a heavy portion of assorted veggies.",
          prep: 15,
          ingredients: ["Rice", "Assorted Veg", "Soy"],
          allergens: ["Soy"],
          image: "https://b.zmtcdn.com/data/dish_photos/b37/eae06fa35291e2b5d383680a1a1afb37.jpg"
        },
        {
          name: "Schezwan Fried Rice",
          price: 199,
          desc: "Spicy vegetable fried rice in fiery Schezwan sauce.",
          prep: 15,
          ingredients: ["Rice", "Veg", "Red Chilli Paste"],
          allergens: ["Soy"],
          image: "https://www.whiskaffair.com/wp-content/uploads/2020/09/Schezwan-Fried-Rice-2-3.jpg"
        },
        {
          name: "Shanghai Fried Rice",
          price: 219,
          desc: "Vegetable fried rice with traditional Shanghai seasonings.",
          prep: 15,
          ingredients: ["Rice", "Veggies", "Shanghai Sauce"],
          allergens: ["Soy"],
          image: ""
        },
        {
          name: "Singapori Fried Rice",
          price: 229,
          desc: "Turmeric flavored rice with curry powder and veggies.",
          prep: 15,
          ingredients: ["Rice", "Curry Powder", "Veg"],
          allergens: ["Soy"],
          image: ""
        }
      ]
    },
    {
      name: "Sides, Salad & Raita",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?q=80&w=1000",
      items: [
        {
          name: "Green Salad",
          price: 99,
          desc: "Fresh seasonal sliced raw vegetables.",
          prep: 5,
          ingredients: ["Cucumber", "Carrot", "Onion", "Tomato"],
          allergens: [],
          image: "https://b.zmtcdn.com/data/dish_photos/917/8f99696a88686446444035e22d393917.jpg"
        },
        {
          name: "Onion Salad",
          price: 69,
          desc: "Sliced onions with lemon and green chillies.",
          prep: 5,
          ingredients: ["Onion", "Lemon", "Chilli"],
          allergens: [],
          image: ""
        },
        {
          name: "Kachumber Salad",
          price: 189,
          desc: "Diced vegetables tossed with lemon juice and chaat masala.",
          prep: 8,
          ingredients: ["Tomato", "Cucumber", "Onion", "Chaat Masala"],
          allergens: [],
          image: ""
        },
        {
          name: "Peanut Salad",
          price: 199,
          desc: "Crunchy roasted peanuts with onions and tangy spices.",
          prep: 10,
          ingredients: ["Peanuts", "Onion", "Tomato", "Lemon"],
          allergens: ["Nuts"],
          image: "https://greenbowl2soul.com/wp-content/uploads/2020/03/Peanut-Salad.jpg"
        },
        {
          name: "Masala Papad",
          price: 109,
          desc: "Crispy papad topped with spicy onion-tomato salad.",
          prep: 8,
          ingredients: ["Papad", "Onion", "Tomato", "Spices"],
          allergens: [],
          image: "https://bfoodale.com/uploads/2021/12/Fry-Papad-1.jpg"
        },
        {
          name: "Plain Curd",
          price: 89,
          desc: "Freshly set thick yogurt.",
          prep: 5,
          ingredients: ["Milk"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Mix Raita",
          price: 129,
          desc: "Yogurt with diced vegetables and roasted cumin.",
          prep: 8,
          ingredients: ["Yogurt", "Cucumber", "Onion", "Tomato"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Bundi Raita",
          price: 105,
          desc: "Yogurt with crispy chickpea flour droplets.",
          prep: 8,
          ingredients: ["Yogurt", "Boondi"],
          allergens: ["Dairy"],
          image: "https://priyakitchenette.com/wp-content/uploads/2014/09/BOONDI-RAITA-500x500.jpg"
        },
        {
          name: "Pineapple Raita",
          price: 149,
          desc: "Sweet and tangy yogurt with pineapple bits.",
          prep: 10,
          ingredients: ["Yogurt", "Pineapple", "Sugar"],
          allergens: ["Dairy"],
          image: "https://static.toiimg.com/thumb/58840660.cms?width=1200&height=900"
        }
      ]
    },
    {
      name: "Desserts & Drinks",
      isVeg: true,
      image: "https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=1000",
      items: [
        {
          name: "Hot Gulab Jamun",
          price: 79,
          desc: "Warm milk-solid dumplings in rose-scented syrup.",
          prep: 5,
          ingredients: ["Khoya", "Sugar Syrup", "Cardamom"],
          allergens: ["Dairy", "Gluten"],
          image: "https://static.toiimg.com/thumb/63799510.cms?imgsize=1091643&width=800&height=800"
        },
        {
          name: "Hot Gulab Jamun with Ice-Cream",
          price: 139,
          desc: "Warm jamuns paired with a scoop of cold vanilla.",
          prep: 5,
          ingredients: ["Gulab Jamun", "Vanilla Ice Cream"],
          allergens: ["Dairy", "Gluten"],
          image: "https://images.unsplash.com/photo-1593504049359-74330189a345?q=80&w=1000"
        },
        {
          name: "Mix Ice Cream",
          price: 169,
          desc: "Selection of various ice cream scoops.",
          prep: 5,
          ingredients: ["Assorted Ice Cream"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Butter Scotch Ice Cream",
          price: 105,
          desc: "Creamy butterscotch flavored ice cream.",
          prep: 5,
          ingredients: ["Ice Cream", "Butterscotch bits"],
          allergens: ["Dairy"],
          image: "https://www.sidechef.com/recipe/a3b228d7-975f-4fda-a718-d20e6db3936a.jpeg?d=1408x1120"
        },
        {
          name: "Kesar Pista Ice Cream",
          price: 119,
          desc: "Traditional saffron and pistachio flavored ice cream.",
          prep: 5,
          ingredients: ["Ice Cream", "Saffron", "Pistachio"],
          allergens: ["Dairy", "Nuts"],
          image: ""
        },
        {
          name: "Chocolate Ice Cream",
          price: 109,
          desc: "Rich chocolate flavored frozen dessert.",
          prep: 5,
          ingredients: ["Ice Cream", "Cocoa"],
          allergens: ["Dairy"],
          image: "https://cdn.loveandlemons.com/wp-content/uploads/2025/05/chocolate-ice-cream.jpg"
        },
        {
          name: "Vanilla Ice Cream",
          price: 105,
          desc: "Classic smooth vanilla bean ice cream.",
          prep: 5,
          ingredients: ["Ice Cream", "Vanilla"],
          allergens: ["Dairy"],
          image: "https://www.sugarfree-india.com/wp-content/uploads/2025/12/vanilla-ice-cream-1.webp"
        },
        {
          name: "Assorted Soft Drinks",
          price: 55,
          desc: "Assorted chilled carbonated soft drinks.",
          prep: 2,
          ingredients: ["Soft Drink"],
          allergens: [],
          image: ""
        },
        {
          name: "Masala Soft Drinks",
          price: 75,
          desc: "Soft drink with a spicy tang of chaat masala and lemon.",
          prep: 5,
          ingredients: ["Soft Drink", "Chaat Masala", "Lemon"],
          allergens: [],
          image: ""
        },
        {
          name: "Mineral Water",
          price: 25,
          desc: "Packaged 1L purified drinking water.",
          prep: 1,
          ingredients: ["Water"],
          allergens: [],
          image: ""
        },
        {
          name: "Cold Coffee",
          price: 149,
          desc: "Refreshing blended coffee with milk and sugar.",
          prep: 8,
          ingredients: ["Coffee", "Milk", "Ice Cream"],
          allergens: ["Dairy"],
          image: "https://poornatva.com/cdn/shop/files/20230519-DSC_4623-2.jpg?v=1685874201"
        },
        {
          name: "Vanilla Shake",
          price: 139,
          desc: "Thick milk shake flavored with vanilla.",
          prep: 10,
          ingredients: ["Milk", "Vanilla Ice Cream"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Chocolate Shake",
          price: 159,
          desc: "Thick and rich blended chocolate milk shake.",
          prep: 10,
          ingredients: ["Milk", "Chocolate Sauce", "Ice Cream"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Coffee",
          price: 80,
          desc: "Classic hot milk coffee.",
          prep: 8,
          ingredients: ["Milk", "Coffee beans"],
          allergens: ["Dairy"],
          image: ""
        },
        {
          name: "Tea",
          price: 50,
          desc: "Traditional Indian milk tea with ginger and cardamom.",
          prep: 8,
          ingredients: ["Tea leaves", "Milk", "Ginger"],
          allergens: ["Dairy"],
          image: "https://cdn2.foodviva.com/static-content/food-images/tea-recipes/milk-tea-recipe/milk-tea-recipe.jpg"
        },
        {
          name: "Mojito",
          price: 179,
          desc: "Refreshing non-alcoholic mint and lime mocktail.",
          prep: 10,
          ingredients: ["Mint", "Lime", "Soda"],
          allergens: [],
          image: "https://www.artofdrink.com/wp-content/uploads/2010/08/how-to-make-a-mojito-recipe-735x1103.jpg"
        }
      ]
    }
  ];



const restaurantConfigs: RestaurantSeedConfig[] = [
  {
    subdomain: 'haveli-dhaba',
    name: 'Haveli Dhaba',
    email: 'havelidhaba@gmail.com',
    phone: '+91 91428 45094',
    address: 'Near Vikash Vidyalaya, Nevri Chowk, Ring Road, Ranchi (Jh.)',
    city: 'Ranchi',
    state: 'Jharkhand',
    country: 'India',
    cuisineTypes: ['North Indian', 'Chinese'],
    ownerEmail: 'owner@haveli.com',
    categories: HAVELI_MENU_DATA.map(cat => ({ 
      name: cat.name, 
      description: `Delicious ${cat.name} from our kitchen` 
    })),
    menuItems: HAVELI_MENU_DATA.flatMap(cat => 
      cat.items.map(item => ({
        name: item.name,
        description: item.desc,
        price: item.price,
        categoryName: cat.name,
        // Fallback to category isVeg if the item doesn't explicitly state it
        isVeg: item.isVeg !== undefined ? item.isVeg : cat.isVeg,
        // Auto-assign SpiceLevel based on Veg/Non-Veg
        spiceLevel: (item.isVeg === false || cat.isVeg === false) ? SpiceLevel.MEDIUM : SpiceLevel.MILD,
        image:item.image
      }))
    ),
    popularDishes: ['Chicken Handi (4 P/2 P)', 'Paneer Butter Masala', 'Chicken Lollipop', 'Butter Naan'],
    tables: [
      { number: 1, capacity: 4, location: 'Main Dining Hall' },
      { number: 2, capacity: 4, location: 'Main Dining Hall' },
      { number: 3, capacity: 2, location: 'Window Side' },
      { number: 4, capacity: 8, location: 'Family Section' },
      { number: 5, capacity: 4, location: 'Outdoor Seating' },
      { number: 6, capacity: 4, location: 'Main Dining Hall' },
      { number: 7, capacity: 4, location: 'Main Dining Hall' },
      { number: 8, capacity: 2, location: 'Window Side' },
      { number: 9, capacity: 8, location: 'Family Section' },
      { number: 10, capacity: 4, location: 'Outdoor Seating' },
    ],
    coupons: [
      { code: 'BITEFORBIT', type: CouponType.PERCENT, value: 10, minOrderPaise: 50000, maxDiscountPaise: 20000, active: true },
    ],
    offers: [
      { name: 'For BIT Mesra Students', description: 'Exclusive discount for students from BIT Mesra', discountType: 'PERCENT', value: 10, minOrderPaise: 40000, maxDiscountPaise: 25000, type: OfferType.PERCENTAGE, active: true },
    ],

    
  },
  // {
  //   subdomain: 'demo',
  //   name: 'Demo Restaurant',
  //   email: 'demo@restaurant.com',
  //   phone: '+91 90000 00000',
  //   address: '123 Demo Street, Bengaluru',
  //   city: 'Bengaluru',
  //   state: 'Karnataka',
  //   country: 'India',
  //   cuisineTypes: ['Indian', 'Continental'],
  //   ownerEmail: 'owner@demo.com',
  //   categories: [
  //     { name: 'Appetizers', description: 'Start your meal with favorites' },
  //     { name: 'Main Courses', description: 'Signature mains' },
  //     { name: 'Desserts', description: 'Sweet endings' },
  //   ],
  //   menuItems: [
  //     { name: 'Paneer Tikka', description: 'Smoky paneer skewers', price: 299, categoryName: 'Appetizers', isVeg: true, spiceLevel: SpiceLevel.MEDIUM },
  //     { name: 'Chicken Wings', description: 'Crispy wings with spice rub', price: 349, categoryName: 'Appetizers', isVeg: false, spiceLevel: SpiceLevel.HOT },
  //     { name: 'Butter Chicken', description: 'Creamy tomato gravy', price: 449, categoryName: 'Main Courses', isVeg: false, spiceLevel: SpiceLevel.MILD },
  //     { name: 'Dal Makhani', description: 'Slow cooked lentils', price: 299, categoryName: 'Main Courses', isVeg: true, spiceLevel: SpiceLevel.MILD },
  //     { name: 'Gulab Jamun', description: 'Classic dessert', price: 149, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //   ],
  //   popularDishes: ['Butter Chicken', 'Paneer Tikka', 'Dal Makhani'],
  //   tables: [
  //     { number: 1, capacity: 2, location: 'Window side' },
  //     { number: 2, capacity: 4, location: 'Center area' },
  //   ],
  //   coupons: [
  //     { code: 'WELCOME10', type: CouponType.PERCENT, value: 10, minOrderPaise: 50000, maxDiscountPaise: 20000, active: true },
  //     { code: 'FLAT50', type: CouponType.FIXED, value: 5000, minOrderPaise: 20000, active: true },
  //   ],
  //   offers: [
  //     { name: 'Weekend Special', description: '10% off on weekends', discountType: 'PERCENT', value: 10, minOrderPaise: 40000, maxDiscountPaise: 25000, type: OfferType.PERCENTAGE, active: true },
  //   ],
  // },
  // {
  //   subdomain: 'spice-garden',
  //   name: 'Spice Garden',
  //   email: 'hello@spicegarden.com',
  //   phone: '+91 91234 56780',
  //   address: '78 Residency Road, Bengaluru',
  //   city: 'Bengaluru',
  //   state: 'Karnataka',
  //   country: 'India',
  //   cuisineTypes: ['North Indian'],
  //   ownerEmail: 'owner@spicegarden.com',
  //   categories: [
  //     { name: 'Starters', description: 'Tandoori delights' },
  //     { name: 'Main Course', description: 'Rich curries' },
  //     { name: 'Breads', description: 'Fresh from the tandoor' },
  //   ],
  //   menuItems: [
  //     { name: 'Paneer Tikka', description: 'Charred paneer with spices', price: 350, categoryName: 'Starters', isVeg: true, spiceLevel: SpiceLevel.MEDIUM },
  //     { name: 'Dal Makhani', description: 'Creamy lentils', price: 450, categoryName: 'Main Course', isVeg: true, spiceLevel: SpiceLevel.MILD },
  //     { name: 'Butter Naan', description: 'Soft naan with butter', price: 60, categoryName: 'Breads', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //   ],
  //   popularDishes: ['Dal Makhani', 'Paneer Tikka'],
  //   tables: [
  //     { number: 1, capacity: 4, location: 'Family zone' },
  //     { number: 2, capacity: 2, location: 'Couple seating' },
  //   ],
  //   coupons: [
  //     { code: 'SPICE15', type: CouponType.PERCENT, value: 15, minOrderPaise: 60000, maxDiscountPaise: 30000, active: true },
  //   ],
  //   offers: [
  //     { name: 'Lunch Saver', description: 'Flat 75 off on lunch', discountType: 'FIXED', value: 7500, minOrderPaise: 25000, type: OfferType.FIXED_AMOUNT, active: true },
  //   ],
  // },
  // {
  //   subdomain: 'coastal-bites',
  //   name: 'Coastal Bites',
  //   email: 'team@coastalbites.com',
  //   phone: '+91 92222 11133',
  //   address: '22 Beach Road, Chennai',
  //   city: 'Chennai',
  //   state: 'Tamil Nadu',
  //   country: 'India',
  //   cuisineTypes: ['Seafood', 'Continental'],
  //   ownerEmail: 'owner@coastalbites.com',
  //   categories: [
  //     { name: 'Fresh Catch', description: 'Straight from the ocean' },
  //     { name: 'Beverages', description: 'Coastal coolers' },
  //     { name: 'Desserts', description: 'Sweet treats' },
  //   ],
  //   menuItems: [
  //     { name: 'Grilled Salmon', description: 'Herb grilled salmon', price: 850, categoryName: 'Fresh Catch', isVeg: false, spiceLevel: SpiceLevel.MEDIUM },
  //     { name: 'Prawn Curry', description: 'Coastal style curry', price: 650, categoryName: 'Fresh Catch', isVeg: false, spiceLevel: SpiceLevel.HOT },
  //     { name: 'Fresh Lime Soda', description: 'Citrus fizz', price: 120, categoryName: 'Beverages', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //     { name: 'Chocolate Lava Cake', description: 'Warm chocolate center', price: 199, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //   ],
  //   popularDishes: ['Grilled Salmon', 'Prawn Curry', 'Fresh Lime Soda'],
  //   tables: [
  //     { number: 1, capacity: 6, location: 'Sea view' },
  //     { number: 2, capacity: 4, location: 'Indoor' },
  //   ],
  //   coupons: [
  //     { code: 'SEAFOOD20', type: CouponType.PERCENT, value: 20, minOrderPaise: 80000, maxDiscountPaise: 50000, active: true },
  //   ],
  //   offers: [
  //     { name: 'Happy Hours', description: '15% off between 4-6 PM', discountType: 'PERCENT', value: 15, minOrderPaise: 30000, type: OfferType.PERCENTAGE, active: true },
  //   ],
  // },
  // {
  //   subdomain: 'urban-cafe',
  //   name: 'Urban Cafe',
  //   email: 'contact@urbancafe.com',
  //   phone: '+91 93333 22210',
  //   address: '5 Park Street, Kolkata',
  //   city: 'Kolkata',
  //   state: 'West Bengal',
  //   country: 'India',
  //   cuisineTypes: ['Cafe', 'Desserts'],
  //   ownerEmail: 'owner@urbancafe.com',
  //   categories: [
  //     { name: 'Coffee', description: 'Fresh brews' },
  //     { name: 'Beverages', description: 'Smooth sips' },
  //     { name: 'Desserts', description: 'Cafe favorites' },
  //   ],
  //   menuItems: [
  //     { name: 'Filter Coffee', description: 'South Indian brew', price: 69, categoryName: 'Coffee', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //     { name: 'Mango Lassi', description: 'Creamy mango drink', price: 119, categoryName: 'Beverages', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //     { name: 'Chocolate Lava Cake', description: 'Warm chocolate cake', price: 199, categoryName: 'Desserts', isVeg: true, spiceLevel: SpiceLevel.NONE },
  //   ],
  //   popularDishes: ['Filter Coffee', 'Chocolate Lava Cake'],
  //   tables: [
  //     { number: 1, capacity: 2, location: 'Window bar' },
  //     { number: 2, capacity: 2, location: 'Quiet corner' },
  //   ],
  //   coupons: [
  //     { code: 'CAFE5', type: CouponType.PERCENT, value: 5, minOrderPaise: 15000, maxDiscountPaise: 8000, active: true },
  //   ],
  //   offers: [
  //     { name: 'Dessert Duo', description: 'Flat 30 off on desserts', discountType: 'FIXED', value: 3000, minOrderPaise: 12000, type: OfferType.FIXED_AMOUNT, active: true },
  //   ],
  // },
];

async function upsertRestaurant(config: RestaurantSeedConfig) {
  return prisma.restaurant.upsert({
    where: { subdomain: config.subdomain },
    update: {
      name: config.name,
      email: config.email,
      phone: config.phone,
      address: config.address,
      city: config.city,
      state: config.state,
      country: config.country,
      cuisineTypes: config.cuisineTypes,
      status: OnboardingStatus.APPROVED,
      active: true,
      acceptedPaymentMethods: ['RAZORPAY', 'CASH'],
    },
    create: {
      name: config.name,
      slug: config.subdomain,
      subdomain: config.subdomain,
      email: config.email,
      phone: config.phone,
      address: config.address,
      city: config.city,
      state: config.state,
      country: config.country,
      status: OnboardingStatus.APPROVED,
      commissionRate: 10,
      cuisineTypes: config.cuisineTypes,
      acceptedPaymentMethods: ['RAZORPAY', 'CASH'],
      active: true,
    },
  });
}

async function upsertOwner(config: RestaurantSeedConfig) {
  const owner = await prisma.user.upsert({
    where: { email: config.ownerEmail },
    update: { role: UserRole.OWNER },
    create: {
      email: config.ownerEmail,
      name: `${config.name} Owner`,
      password: await bcrypt.hash('owner123', 12),
      role: UserRole.OWNER,
      verified: true,
    },
  });
  return owner;
}

async function main() {
  for (const config of restaurantConfigs) {
    console.log(`Seeding: ${config.name}...`);

    const restaurant = await upsertRestaurant(config);
    const owner = await upsertOwner(config);

    await prisma.restaurantUser.upsert({
      where: { restaurantId_userId: { restaurantId: restaurant.id, userId: owner.id } },
      update: { role: RestaurantRole.OWNER, active: true },
      create: { restaurantId: restaurant.id, userId: owner.id, role: RestaurantRole.OWNER, active: true },
    });

    // Categories
    const categoryIdByName: Record<string, string> = {};
    for (const category of config.categories) {
      const saved = await prisma.category.upsert({
        where: { restaurantId_name: { restaurantId: restaurant.id, name: category.name } },
        update: { description: category.description ?? null, active: true },
        create: {
          name: category.name,
          description: category.description ?? null,
          active: true,
          sortOrder: 0,
          restaurantId: restaurant.id,
        },
      });
      categoryIdByName[category.name] = saved.id;
    }

    // Menu items (no unique constraint on name+restaurantId, so use findFirst)
    for (const item of config.menuItems) {
      const categoryId = categoryIdByName[item.categoryName];
      if (!categoryId) continue;

      const existing = await prisma.menuItem.findFirst({
        where: { restaurantId: restaurant.id, name: item.name },
        select: { id: true },
      });

      const data = {
        name: item.name,
        description: item.description ?? null,
        pricePaise: Math.round(item.price * 100),
        categoryId,
        restaurantId: restaurant.id,
        available: true,
        spiceLevel: item.spiceLevel,
        isVeg: item.isVeg,
        image: item.image ?? null
      };

      if (existing) {
        await prisma.menuItem.update({ where: { id: existing.id }, data });
      } else {
        await prisma.menuItem.create({ data });
      }
    }

    // Popular dishes
    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      select: { id: true, name: true },
    });
    const menuItemIdByName = new Map(menuItems.map((m) => [m.name, m.id]));
    for (let i = 0; i < config.popularDishes.length; i++) {
      const menuItemId = menuItemIdByName.get(config.popularDishes[i]);
      if (!menuItemId) continue;
      await prisma.popularDish.upsert({
        where: { restaurantId_menuItemId: { restaurantId: restaurant.id, menuItemId } },
        update: { rank: i + 1, active: true },
        create: { restaurantId: restaurant.id, menuItemId, rank: i + 1, active: true },
      });
    }

    // Tables
    for (const table of config.tables) {
      await prisma.table.upsert({
        where: { restaurantId_number: { restaurantId: restaurant.id, number: table.number } },
        update: { capacity: table.capacity, location: table.location ?? null, active: true },
        create: {
          number: table.number,
          capacity: table.capacity,
          location: table.location ?? null,
          active: true,
          restaurantId: restaurant.id,
        },
      });
    }

    // Coupons
    for (const coupon of config.coupons) {
      await prisma.coupon.upsert({
        where: { restaurantId_code: { restaurantId: restaurant.id, code: coupon.code } },
        update: {
          active: coupon.active ?? true,
          type: coupon.type,
          value: coupon.value,
          minOrderPaise: coupon.minOrderPaise ?? null,
          maxDiscountPaise: coupon.maxDiscountPaise ?? null,
        },
        create: {
          restaurantId: restaurant.id,
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          active: coupon.active ?? true,
          minOrderPaise: coupon.minOrderPaise ?? null,
          maxDiscountPaise: coupon.maxDiscountPaise ?? null,
        },
      });
    }

    // Offers (no unique constraint, so use name + restaurantId)
    for (const offer of config.offers) {
      const existingOffer = await prisma.offer.findFirst({
        where: { restaurantId: restaurant.id, name: offer.name },
        select: { id: true },
      });

      const offerData = {
        name: offer.name,
        description: offer.description ?? null,
        discountType: offer.discountType,
        value: offer.value,
        minOrderPaise: offer.minOrderPaise ?? null,
        maxDiscountPaise: offer.maxDiscountPaise ?? null,
        type: offer.type ?? null,
        active: offer.active ?? true,
        restaurantId: restaurant.id,
      };

      if (existingOffer) {
        await prisma.offer.update({ where: { id: existingOffer.id }, data: offerData });
      } else {
        await prisma.offer.create({ data: offerData });
      }
    }
  }

  console.log('Seeding complete: multiple restaurants with unique menus, popular dishes, coupons, and offers.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
