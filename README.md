# IT332-Capstone-TerraGuide

Rey, Mark Xander B.
De Guzman, Matjannus S.
Alaras, Clyde Justin C.

*Think about YOUR capstone system:*
Does your system need to talk to other systems?
- No.
Does your system need external data?
- We've collected data from the Smart Works, owner Mrs. Maricel Buño
Does your system need export/import?
- Yes.
Does your system need automation?
- Yes, We will be using the Google Gemini API for the template generation of needed documents.

Document your answers — this is your project plan.

Title: TERRAGUIDE: A WEB-BASED PROPERTY INFORMATION MANAGEMENT
SYSTEM WITH INTELLIGENT DATA FILTERING AND SEARCH OPTIMIZATION
FOR SMARTWORKS BATANGAS.

*Planning of FeatureS*

During the planning stage of TerraGuide, the team identified the main features that will be included in the system based on the approved objectives. These planned features are divided into three main modules: Buyer Portal, Admin Portal, and Business Analytics.

 * For the Buyer Portal, the team plans to include features that will help buyers easily search and explore available properties. These include a map-based property view, search and filter options, personalized property recommendations, market trends, property details, document generation, and property inquiry features.

* For the Admin Portal, the team plans to develop tools that will help administrators manage property listings, buyer profiles, transaction records, and property statuses. Dashboard summaries, document verification tracking, and filtering tools are also being considered to make data management easier and more organized.

* For the Business Analytics module, the team plans to provide analytics features that can help administrators better understand buyer preferences, property performance, revenue trends, and market demand. These insights are expected to support decision-making and improve overall property management.

These planned features will serve as a guide for the design, development, and implementation of the TerraGuide system in the succeeding phases of the project.


*Techstack planning for TerraGuide*

*FRONTEND*
for the frontend, we will be using the following:
*React.js → We will build reusable components such as stat cards that show property statistics, dashboards,  navigation menus. Its Virtual DOM will ensure updates that are quick and responsive updates, which will be crucial for real-time property searches.

*Typescript → We will be integrating Typescript with Reactto provide static typing and interfaces. This will reduce runtime errors and improve maintainability, making the system more scalable as new features are implemented.

*Tailwind CSS → We will apply Tailwind’s utility‑first classes to design responsive dashboards directly from markup. This will speed up development and ensure consistent styling across the application.


*BACKEND*
For the backend, we will use:

*Node.js → We will implement Node.js We will apply Tailwind’s utility‑first classes to design responsive dashboards directly from markup. This will speed up development and ensure consistent styling across the application.

*REST APIs → We will design REST endpoints to connect the frontend, backend, and database. REST will be chosen over SOAP because of its simplicity and lightweight message format, ensuring smooth synchronization of property listings, client records, and transactions.


*DATABASE*
For the data management, we will use:

MongoDB → We will configure MongoDB Atlas to store property listings, customer information, and transaction histories. Its schema flexibility and ability to handle simultaneous read/write operations will make it suitable for dynamic property data. We will also set up indexing and replication to ensure scalability and high availability.


*VISUALIZATION AND ANALYSIS*
For the visualization and analysis, we will use:

*Chart.js → We will integrate Chart.js with React to provide lightweight, interactive charts for property analytics.

*D3.js → We will use D3.js for advanced, data‑driven visualizations such as drill‑down analysis and scenario simulations.

*AI‑powered BI dashboards → We will implement predictive analytics to forecast property efficiency, buyer preferences, and revenue projections, enhancing decision‑making for SmartWorks Batangas.

*DEVELOPMENT TOOLS*
For the development, we will use:

*Visual Studio Code (VS Code) → We will configure VS Code with extensions for Node.js, MongoDB, and REST API testing to streamline coding and debugging.

*GitHub → We will manage version control, collaboration, and CI/CD pipelines through GitHub to ensure smooth teamwork and project tracking.

*DEPLOYMENT*
For deployment, we will use:

*Vercel → We will deploy the frontend and backend using Vercel’s serverless platform. Its auto‑scaling, caching, and resource allocation features will ensure that TerraGuide remains responsive under varying traffic loads while minimizing infrastructure overhead.

*Flow of the System*

The TerraGuide system starts when a buyer accesses the Buyer Portal. During the first visit, the buyer completes a Welcome Modal that collects preferences such as budget range, preferred location, land type, intended use, and minimum lot size. The system stores this information and uses it to generate personalized property recommendations through the "Suggested For You" feature.

The buyer can browse available properties using the map-based view and apply search filters such as location, land type, and property size. Buyers can view detailed property information, monitor market trends, generate property-related documents, and submit inquiries or site visit requests.

On the Admin Portal, administrators manage property listings, buyer profiles, and transaction records through a centralized system. They can add, update, delete, and organize records while monitoring property statuses such as Available, Reserved, and Sold. Dashboard summary cards provide a quick overview of the system's records and activities.

As buyers and administrators interact with the system, data is collected and stored in the database. The Business Analytics module processes this information to generate buyer preference summaries, property success rate scores, monthly revenue reports, and other analytics that support decision-making.

Through these processes, TerraGuide provides a centralized platform for property management, property discovery, and business analytics for Smart Works Batangas.

