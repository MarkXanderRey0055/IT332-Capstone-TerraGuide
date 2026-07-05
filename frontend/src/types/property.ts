export interface Property {
  id: string;
  title: string;
  price: number;
  location: string;
  lat: number;  // Latitude coordinate
  lng: number;  // Longitude coordinate
}

// // Sample mock data focusing on the Batangas regions
// export const mockProperties: Property[] = [
//   {
//     id: "1",
//     title: "Scenic Nasugbu Beach House",
//     price: 15000000,
//     location: "Nasugbu, Batangas",
//     lat: 14.0722,
//     lng: 120.6288
//   },
//   {
//     id: "2",
//     title: "Balayan Heritage Estate",
//     price: 8500000,
//     location: "Balayan, Batangas",
//     lat: 13.9450,
//     lng: 120.7300
//   },
//   {
//     id: "3",
//     title: "Calaca Overlook Villa",
//     price: 12000000,
//     location: "Calaca, Batangas",
//     lat: 13.9292,
//     lng: 120.8131
//   },
//   {
//     id: "4",
//     title: "Lian Coastal Lot",
//     price: 4500000,
//     location: "Lian, Batangas",
//     lat: 14.0353,
//     lng: 120.6542
//   }
// ];