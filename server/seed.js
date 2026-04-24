const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Seeding database...');

  // Create tables
  await pool.query(`
    DROP TABLE IF EXISTS api_keys, integrity_scores, submissions, students, batch_jobs,
      source_matches, paraphrase_detections, citations, writing_analyses, reports,
      url_checks, ai_detections, documents, users CASCADE;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE documents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      author VARCHAR(255),
      source_type VARCHAR(50) DEFAULT 'text',
      plagiarism_score INTEGER,
      last_scanned TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE ai_detections (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      source VARCHAR(50) DEFAULT 'manual',
      ai_score INTEGER,
      human_score INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      analyzed_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE url_checks (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      title VARCHAR(500),
      description TEXT,
      trust_score INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      checked_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE reports (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      report_type VARCHAR(100) NOT NULL,
      content TEXT,
      summary TEXT,
      ai_summary TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE writing_analyses (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      author VARCHAR(255),
      genre VARCHAR(100),
      analysis_result TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      analyzed_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE citations (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      citation_style VARCHAR(50) DEFAULT 'APA',
      references_text TEXT,
      verification_result TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      verified_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE paraphrase_detections (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      original_text TEXT NOT NULL,
      comparison_text TEXT NOT NULL,
      similarity_score INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      analyzed_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE source_matches (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      content TEXT NOT NULL,
      search_scope VARCHAR(50) DEFAULT 'web',
      matches_found INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      matched_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE batch_jobs (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      job_type VARCHAR(100) NOT NULL,
      documents TEXT,
      priority VARCHAR(50) DEFAULT 'normal',
      status VARCHAR(50) DEFAULT 'pending',
      total_items INTEGER DEFAULT 0,
      processed_items INTEGER DEFAULT 0,
      completed_at TIMESTAMP,
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE students (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      student_id VARCHAR(100),
      department VARCHAR(255),
      institution VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE integrity_scores (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      entity_name VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50) DEFAULT 'document',
      content TEXT,
      score INTEGER DEFAULT 0,
      evaluation_result TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      evaluated_at TIMESTAMP,
      evaluated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE submissions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      student_name VARCHAR(255),
      course VARCHAR(255),
      assignment VARCHAR(255),
      content TEXT,
      submission_type VARCHAR(50) DEFAULT 'essay',
      status VARCHAR(50) DEFAULT 'pending',
      submitted_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE api_keys (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      api_key VARCHAR(255) UNIQUE NOT NULL,
      permissions VARCHAR(50) DEFAULT 'read',
      rate_limit INTEGER DEFAULT 1000,
      status VARCHAR(50) DEFAULT 'active',
      usage_count INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // Seed users
  const hash = await bcrypt.hash('password123', 10);
  await pool.query(`
    INSERT INTO users (name, email, password_hash, role) VALUES
    ('Admin User', 'admin@university.edu', '${hash}', 'admin'),
    ('Dr. Sarah Johnson', 'sarah@university.edu', '${hash}', 'professor'),
    ('Prof. Michael Chen', 'michael@university.edu', '${hash}', 'professor'),
    ('Jane Smith', 'jane@student.edu', '${hash}', 'student'),
    ('John Doe', 'john@student.edu', '${hash}', 'student');
  `);

  // Seed documents (15 items)
  await pool.query(`
    INSERT INTO documents (title, content, author, source_type, plagiarism_score, submitted_by) VALUES
    ('Impact of Climate Change on Marine Ecosystems', 'Climate change has profound effects on marine biodiversity. Rising ocean temperatures alter species distribution patterns, causing mass migrations and habitat loss. Coral bleaching events have increased by 400% since the 1980s, threatening the foundation of marine food webs.', 'Dr. Emily Watson', 'essay', 23, 1),
    ('Machine Learning in Healthcare Diagnostics', 'The application of deep learning algorithms in medical imaging has revolutionized diagnostic accuracy. Convolutional neural networks can now detect malignant tumors with 95% accuracy, surpassing human radiologists in certain categories of diagnosis.', 'Prof. James Liu', 'research', 45, 2),
    ('The Evolution of Democratic Institutions', 'Democratic governance has evolved significantly since ancient Athens. Modern representative democracy incorporates checks and balances, separation of powers, and constitutional protections that were absent in early democratic systems.', 'Maria Rodriguez', 'thesis', 12, 1),
    ('Quantum Computing: A New Paradigm', 'Quantum computers leverage quantum mechanical phenomena such as superposition and entanglement to perform computations that would be intractable for classical computers. Recent advances in error correction have brought practical quantum computing closer to reality.', 'Dr. Alan Park', 'article', 67, 2),
    ('Blockchain Technology in Supply Chain', 'Distributed ledger technology offers unprecedented transparency in supply chain management. Smart contracts automate verification processes, reducing fraud and increasing efficiency across complex multi-party supply chains.', 'Sarah Kim', 'report', 31, 1),
    ('Neuroscience of Decision Making', 'The prefrontal cortex plays a crucial role in executive decision-making processes. Neuroimaging studies have revealed that emotional and rational processing centers interact dynamically during complex decisions, challenging the notion of purely rational choice.', 'Dr. Robert Chen', 'research', 8, 2),
    ('Sustainable Architecture Design Principles', 'Green building design integrates passive solar heating, natural ventilation, and recycled materials to minimize environmental impact. LEED certification standards have driven innovation in sustainable construction practices worldwide.', 'Anna Mueller', 'essay', 19, 1),
    ('The Psychology of Social Media Addiction', 'Social media platforms exploit dopamine-driven feedback loops to maximize user engagement. Variable ratio reinforcement schedules in notification systems mirror mechanisms found in gambling, contributing to compulsive usage patterns.', 'Dr. Lisa Park', 'study', 55, 2),
    ('CRISPR Gene Editing Ethics', 'The ability to precisely edit human germline DNA raises fundamental ethical questions about consent, equity, and the boundaries of human enhancement. International regulatory frameworks struggle to keep pace with rapidly advancing gene editing capabilities.', 'Prof. David Shaw', 'article', 28, 1),
    ('Artificial Intelligence and Employment', 'Automation through AI is projected to displace 85 million jobs globally by 2025, while simultaneously creating 97 million new roles. The net positive outcome depends critically on workforce retraining and education system adaptation.', 'Jennifer Adams', 'report', 41, 2),
    ('Modern Poetry Analysis: The Waste Land', 'T.S. Eliot''s The Waste Land represents a pivotal moment in modernist literature. Its fragmented structure and dense allusions to classical mythology reflect the disillusionment of post-World War I society and challenge traditional poetic forms.', 'Mark Thompson', 'essay', 15, 1),
    ('Renewable Energy Grid Integration', 'Integrating variable renewable energy sources like wind and solar into existing power grids requires sophisticated energy storage solutions and demand response mechanisms. Battery technology advances are critical to achieving carbon neutrality goals.', 'Dr. Wei Zhang', 'research', 33, 2),
    ('Comparative Constitutional Law', 'Constitutional courts across different legal traditions employ varying approaches to judicial review. The American model of diffuse review contrasts sharply with the European model of concentrated constitutional adjudication.', 'Prof. Elena Petrov', 'thesis', 22, 1),
    ('Urban Planning and Public Health', 'City design significantly impacts population health outcomes. Walkable neighborhoods with access to green spaces show 25% lower rates of cardiovascular disease compared to car-dependent suburban developments.', 'Carlos Mendez', 'study', 37, 2),
    ('Data Privacy in the Digital Age', 'The proliferation of personal data collection by technology companies has outpaced privacy legislation. GDPR represents the most comprehensive attempt to regulate data practices, but enforcement challenges and jurisdictional issues remain significant obstacles.', 'Dr. Hannah O''Brien', 'article', 48, 1);
  `);

  // Seed AI detections (15 items)
  await pool.query(`
    INSERT INTO ai_detections (title, content, source, ai_score, human_score, status, submitted_by) VALUES
    ('Student Essay: Climate Change', 'The effects of global warming are far-reaching and multifaceted. Rising temperatures have led to significant changes in weather patterns across the globe, causing more frequent and intense natural disasters.', 'upload', 72, 28, 'completed', 1),
    ('Research Abstract: Neural Networks', 'This paper presents a novel approach to training deep neural networks using adaptive learning rate scheduling. Our method achieves state-of-the-art results on multiple benchmark datasets while requiring significantly fewer computational resources.', 'paste', 85, 15, 'completed', 2),
    ('Blog Post: Technology Trends', 'In the rapidly evolving landscape of technology, artificial intelligence continues to dominate headlines. From chatbots to autonomous vehicles, AI applications are transforming industries at an unprecedented pace.', 'url', 91, 9, 'completed', 1),
    ('Homework: Shakespeare Analysis', 'Shakespeare''s Hamlet explores themes of revenge, mortality, and the complexity of human nature. The play''s protagonist faces a moral dilemma that resonates with audiences across centuries, as he struggles between action and contemplation.', 'upload', 15, 85, 'completed', 2),
    ('Lab Report: Chemical Reactions', 'The experiment demonstrated that the rate of reaction between hydrochloric acid and magnesium ribbon increases with temperature. This observation is consistent with the collision theory of chemical kinetics.', 'paste', 28, 72, 'completed', 1),
    ('Opinion Piece: Education Reform', 'Our education system is fundamentally broken. We continue to prepare students for a world that no longer exists, cramming their heads with facts they can Google in seconds while ignoring the critical thinking and creativity skills they desperately need.', 'paste', 33, 67, 'completed', 2),
    ('Marketing Copy: Product Launch', 'Introducing the revolutionary EcoSmart water bottle - designed with sustainability in mind. Our patented triple-insulation technology keeps your beverages at the perfect temperature for up to 24 hours.', 'url', 88, 12, 'completed', 1),
    ('Academic Paper: Sociology', 'Social stratification in post-industrial societies manifests through increasingly complex mechanisms of economic and cultural capital distribution. Bourdieu''s framework of habitus provides a nuanced lens for understanding these dynamics.', 'upload', 42, 58, 'completed', 2),
    ('News Article: Space Exploration', 'NASA''s Artemis program successfully completed its latest milestone this week, bringing humanity one step closer to establishing a permanent presence on the lunar surface. The achievement marks a significant moment in space exploration history.', 'url', 76, 24, 'completed', 1),
    ('Creative Writing: Short Story', 'The old lighthouse keeper watched the storm roll in from the east, its dark clouds swallowing the horizon like a hungry beast. He had seen a thousand storms in his forty years at the post, but something about this one made his bones ache with a familiar dread.', 'paste', 18, 82, 'completed', 2),
    ('Technical Documentation: API Guide', 'The REST API endpoints follow standard HTTP conventions. To authenticate, include your API key in the Authorization header using Bearer token format. All responses are returned in JSON format with appropriate HTTP status codes.', 'paste', 79, 21, 'completed', 1),
    ('Dissertation Chapter: Economics', 'The relationship between monetary policy and inflation expectations has been extensively studied in the post-Keynesian literature. However, recent developments in behavioral economics suggest that traditional models may underestimate the role of cognitive biases.', 'upload', 35, 65, 'completed', 2),
    ('Social Media Post Analysis', 'Just finished reading this amazing book about quantum physics! It completely changed how I think about reality. Highly recommend it to anyone who wants their mind blown! #science #physics #bookrecommendation', 'url', 12, 88, 'completed', 1),
    ('Grant Proposal: Medical Research', 'This proposal outlines a three-year research program investigating the efficacy of novel immunotherapy approaches for treatment-resistant pancreatic cancer. Our preliminary data suggests a 40% improvement in patient outcomes.', 'upload', 55, 45, 'pending', 2),
    ('Philosophy Essay: Free Will', 'The compatibilist position on free will offers a compelling middle ground between hard determinism and libertarian free will. By redefining freedom as the absence of external coercion rather than metaphysical indeterminism, compatibilism preserves moral responsibility.', 'paste', 48, 52, 'completed', 1);
  `);

  // Seed URL checks (15 items)
  await pool.query(`
    INSERT INTO url_checks (url, title, description, trust_score, status, submitted_by) VALUES
    ('https://example-research.com/paper/2024/climate', 'Climate Research Paper', 'Academic paper on climate change impacts', 85, 'completed', 1),
    ('https://blog.techwriter.io/ai-trends-2024', 'AI Trends Blog Post', 'Technology blog about AI developments', 45, 'completed', 2),
    ('https://student-essays.net/free-essays/history', 'Free Essay Site', 'Known essay mill website', 12, 'completed', 1),
    ('https://nature.com/articles/quantum-computing', 'Nature: Quantum Computing', 'Peer-reviewed article on quantum computing', 97, 'completed', 2),
    ('https://medium.com/@author/machine-learning-guide', 'ML Guide on Medium', 'Medium article about machine learning basics', 62, 'completed', 1),
    ('https://arxiv.org/abs/2024.12345', 'arXiv Preprint', 'Preprint on neural network architectures', 88, 'completed', 2),
    ('https://wikipedia.org/wiki/Artificial_Intelligence', 'Wikipedia: AI', 'Wikipedia article on artificial intelligence', 72, 'completed', 1),
    ('https://coursehero.com/study-guides/biology', 'Course Hero Study Guide', 'Online study resource platform', 25, 'completed', 2),
    ('https://scholar.google.com/citations?user=abc123', 'Google Scholar Profile', 'Researcher profile and publications', 91, 'completed', 1),
    ('https://spinbot.com/paraphrased-content', 'Spinbot Content', 'Content from known spinning tool', 8, 'completed', 2),
    ('https://jstor.org/stable/research-paper', 'JSTOR Research Paper', 'Academic database article', 95, 'completed', 1),
    ('https://reddit.com/r/science/comments/study', 'Reddit Science Discussion', 'Community discussion about research', 55, 'completed', 2),
    ('https://pubmed.gov/article/genetics-study', 'PubMed: Genetics Study', 'Medical research database entry', 93, 'completed', 1),
    ('https://essaytyper.com/essay/economics', 'EssayTyper Generated', 'Auto-generated essay content', 5, 'completed', 2),
    ('https://ieee.org/document/neural-networks', 'IEEE: Neural Networks', 'IEEE conference paper on deep learning', 96, 'pending', 1);
  `);

  // Seed reports (15 items)
  await pool.query(`
    INSERT INTO reports (title, report_type, content, summary, status, created_by) VALUES
    ('Q1 2024 Plagiarism Trends Report', 'quarterly', 'Analysis of plagiarism patterns across all departments for Q1 2024', 'Plagiarism rates decreased by 12% compared to Q4 2023', 'completed', 1),
    ('Computer Science Department Audit', 'department', 'Full integrity audit of CS department submissions', 'Found 23 cases requiring investigation', 'completed', 2),
    ('AI Content Detection Accuracy Report', 'analysis', 'Evaluation of AI detection accuracy across different content types', 'Detection accuracy averages 89% across all content types', 'completed', 1),
    ('Student Integrity Compliance Report', 'compliance', 'Annual compliance review of student academic integrity policies', '95% of students completed integrity training', 'completed', 2),
    ('Cross-Reference Analysis: Biology 101', 'course', 'Cross-referencing all submissions in Biology 101 for similarities', '3 submission pairs showed concerning similarity levels', 'draft', 1),
    ('Graduate Thesis Originality Summary', 'thesis', 'Summary of originality scores for all graduate theses submitted in 2024', 'Average originality score: 87%', 'completed', 2),
    ('International Student Writing Patterns', 'research', 'Analysis of writing patterns among international students', 'Identified need for additional writing support resources', 'completed', 1),
    ('Engineering Department Monthly Review', 'monthly', 'Monthly plagiarism detection summary for Engineering', '156 submissions scanned, 8 flagged for review', 'completed', 2),
    ('AI Tool Usage in Student Submissions', 'investigation', 'Investigation into AI tool usage among undergraduate students', '34% of flagged submissions showed signs of AI assistance', 'completed', 1),
    ('Library Resource Citation Audit', 'audit', 'Audit of citation practices using library resources', 'Citation accuracy improved 15% after workshop program', 'completed', 2),
    ('Peer Review Integrity Assessment', 'assessment', 'Assessment of peer review processes for maintaining integrity', 'Recommended enhanced blind review protocols', 'draft', 1),
    ('Online Exam Proctoring Results', 'exam', 'Analysis of online exam integrity monitoring results', '98.5% of exams completed without integrity flags', 'completed', 2),
    ('Faculty Training Effectiveness Report', 'training', 'Evaluation of faculty plagiarism detection training program', 'Faculty detection accuracy improved by 28%', 'completed', 1),
    ('Multi-Institution Comparison Study', 'comparative', 'Comparison of plagiarism rates across partner institutions', 'Our institution ranks in the top quartile for integrity', 'completed', 2),
    ('Year-End Academic Integrity Summary', 'annual', 'Comprehensive annual summary of all integrity-related activities', 'Total scans: 45,231 | Flagged: 1,234 | Confirmed: 567', 'draft', 1);
  `);

  // Seed writing analyses (15 items)
  await pool.query(`
    INSERT INTO writing_analyses (title, content, author, genre, status, submitted_by) VALUES
    ('Freshman Essay Sample', 'The American Dream has always been a central theme in our national consciousness. From the earliest settlers to modern immigrants, the promise of opportunity has drawn people to these shores seeking a better life for themselves and their families.', 'Emily Johnson', 'essay', 'pending', 1),
    ('Graduate Research Writing', 'This systematic review examines the efficacy of cognitive behavioral therapy interventions for adolescent anxiety disorders. A comprehensive search of PubMed, PsycINFO, and Cochrane databases yielded 847 potentially relevant studies.', 'Michael Chen', 'academic', 'completed', 2),
    ('Creative Fiction Submission', 'The rain fell in silver sheets across the empty parking lot, each droplet catching the neon glow of the diner sign like tiny falling stars. Inside, Martha wiped down the counter for the hundredth time that evening.', 'Sarah Williams', 'fiction', 'pending', 1),
    ('Technical Report: System Architecture', 'The proposed microservices architecture employs a service mesh pattern using Istio for inter-service communication. Each service is containerized using Docker and orchestrated through Kubernetes, enabling horizontal scaling.', 'David Park', 'technical', 'completed', 2),
    ('Political Science Paper', 'The rise of populism in Western democracies can be attributed to a complex interplay of economic anxiety, cultural backlash, and institutional distrust. This paper examines these factors through a comparative lens.', 'Maria Santos', 'academic', 'pending', 1),
    ('Business Plan Executive Summary', 'TechEd Solutions addresses the growing demand for personalized STEM education through an AI-powered adaptive learning platform. Our proprietary algorithm adjusts difficulty and content in real-time based on student performance metrics.', 'James Lee', 'business', 'completed', 2),
    ('Medical Case Study', 'A 45-year-old male presented with acute onset chest pain radiating to the left arm, accompanied by diaphoresis and shortness of breath. Initial ECG revealed ST-segment elevation in leads II, III, and aVF.', 'Dr. Rachel Green', 'medical', 'pending', 1),
    ('Historical Analysis', 'The Treaty of Westphalia in 1648 fundamentally altered the European political landscape by establishing the principle of state sovereignty. This watershed moment marked the transition from feudal to modern international relations.', 'Thomas Anderson', 'historical', 'completed', 2),
    ('Environmental Impact Assessment', 'The proposed wind farm development in the coastal region requires careful consideration of migratory bird patterns, marine ecosystem impacts, and visual landscape effects. Our assessment utilized three years of ecological monitoring data.', 'Lisa Nguyen', 'report', 'pending', 1),
    ('Philosophical Treatise', 'The concept of consciousness remains one of philosophy''s most intractable problems. Chalmers'' hard problem articulates the explanatory gap between physical processes and subjective experience with compelling clarity.', 'Prof. Alan Moore', 'philosophy', 'completed', 2),
    ('Journalistic Investigation', 'Three months of investigation into the city''s water treatment facilities revealed systemic failures in quality control protocols. Internal documents show that warning signs were repeatedly dismissed by management.', 'Kate Morrison', 'journalism', 'pending', 1),
    ('Legal Brief Analysis', 'The defendant''s motion for summary judgment fails to establish the absence of genuine material facts in dispute. Plaintiff''s evidence, viewed in the light most favorable to the non-moving party, creates triable issues of fact.', 'Robert Chang', 'legal', 'completed', 2),
    ('Psychology Lab Report', 'Participants in the experimental condition demonstrated significantly higher rates of prosocial behavior compared to the control group (p < .001). These findings support the hypothesis that exposure to cooperative framing increases altruistic responses.', 'Amy Foster', 'scientific', 'pending', 1),
    ('Sociology Dissertation Chapter', 'The gig economy has fundamentally restructured labor relations in post-industrial societies. Drawing on interviews with 150 gig workers, this chapter examines how platform-mediated work challenges traditional notions of employment.', 'Carlos Rivera', 'academic', 'completed', 2),
    ('Art History Critique', 'Frida Kahlo''s self-portraits transcend mere representation to become powerful statements about identity, pain, and resilience. Her fusion of Mexican folk art traditions with surrealist techniques created a visual vocabulary that remains profoundly influential.', 'Nina Patel', 'critique', 'pending', 1);
  `);

  // Seed citations (15 items)
  await pool.query(`
    INSERT INTO citations (title, content, citation_style, references_text, status, submitted_by) VALUES
    ('Climate Change Research Paper', 'According to Smith (2023), global temperatures have risen by 1.1°C since pre-industrial times. This finding is supported by multiple studies (Jones et al., 2022; Williams, 2023).', 'APA', 'Smith, J. (2023). Global Temperature Trends. Nature, 45(2), 112-128.\nJones, A., et al. (2022). Climate Indicators. Science, 33(1), 45-67.', 'completed', 1),
    ('Psychology Literature Review', 'Bandura''s (1977) social learning theory posits that behavior is learned through observation. More recent work by Chen and Liu (2021) extends this framework to digital environments.', 'APA', 'Bandura, A. (1977). Social Learning Theory. Prentice Hall.\nChen, W., & Liu, M. (2021). Digital Social Learning. J. Psychology, 89(3), 234-251.', 'pending', 2),
    ('Historical Analysis MLA', 'According to Johnson, the Renaissance marked a fundamental shift in European intellectual life (45). Thompson argues that this transition was more gradual than traditionally believed (112-115).', 'MLA', 'Johnson, Robert. The Renaissance Revolution. Oxford UP, 2020.\nThompson, Mary. Gradual Enlightenment. Cambridge UP, 2021.', 'completed', 1),
    ('Medical Research Citations', 'The efficacy of immunotherapy in treating melanoma has been well-documented (Brown et al., 2022; Davis, 2023). Recent meta-analyses confirm a 45% improvement in five-year survival rates.', 'Vancouver', '1. Brown A, et al. Immunotherapy outcomes. Lancet. 2022;399:1234-45.\n2. Davis R. Melanoma treatment advances. BMJ. 2023;380:e072541.', 'completed', 2),
    ('Computer Science IEEE Format', 'Deep learning architectures have shown remarkable performance in NLP tasks [1]. Transformer models, in particular, have revolutionized the field [2], [3].', 'IEEE', '[1] Y. LeCun, "Deep Learning," Nature, vol. 521, pp. 436-444, 2015.\n[2] A. Vaswani et al., "Attention Is All You Need," NeurIPS, 2017.\n[3] J. Devlin et al., "BERT," NAACL, 2019.', 'pending', 1),
    ('Sociology Chicago Style', 'Weber''s concept of bureaucratic rationalization continues to shape organizational studies. As DiMaggio and Powell note, institutional isomorphism explains why organizations in similar fields tend to become similar over time.', 'Chicago', 'Weber, Max. Economy and Society. Berkeley: UC Press, 1978.\nDiMaggio, Paul, and Walter Powell. "The Iron Cage Revisited." ASR 48 (1983): 147-160.', 'completed', 2),
    ('Education Research Paper', 'Vygotsky (1978) emphasized the zone of proximal development as critical for learning. Contemporary applications include scaffolded instruction (Wood & Ross, 2020) and collaborative problem-solving (Ahmed, 2022).', 'APA', 'Vygotsky, L. (1978). Mind in Society. Harvard UP.\nWood, D., & Ross, G. (2020). Modern Scaffolding. Education Review, 72(1), 1-15.\nAhmed, S. (2022). Collaborative Learning. Teaching, 44(3), 89-102.', 'pending', 1),
    ('Environmental Science Report', 'Carbon sequestration rates in temperate forests vary significantly by species composition (Miller, 2021). Old-growth forests store an estimated 30-50% more carbon per hectare than managed plantations (Green & Park, 2022).', 'APA', 'Miller, T. (2021). Forest Carbon Dynamics. Ecology, 102(8), e03421.\nGreen, S., & Park, J. (2022). Carbon Storage Comparison. Global Change Biology, 28(5), 1567-1582.', 'completed', 2),
    ('Philosophy Paper Harvard Style', 'Rawls'' original position thought experiment remains influential in political philosophy (Rawls 1971). Critics such as Nozick (1974) and Sandel (1982) have offered significant counterarguments to the veil of ignorance methodology.', 'Harvard', 'Rawls, J 1971, A Theory of Justice, Harvard University Press, Cambridge.\nNozick, R 1974, Anarchy, State, and Utopia, Basic Books, New York.\nSandel, M 1982, Liberalism and the Limits of Justice, Cambridge University Press.', 'completed', 1),
    ('Business Case Study', 'Porter''s five forces framework (Porter, 1979) provides a foundation for competitive analysis. Recent adaptations by Brandenburger and Nalebuff (1996) incorporate game theory to model strategic interactions more accurately.', 'APA', 'Porter, M.E. (1979). Competitive Forces. Harvard Business Review, 57(2), 137-145.\nBrandenburger, A.M., & Nalebuff, B.J. (1996). Co-opetition. Doubleday.', 'pending', 2),
    ('Art History Analysis', 'Berger''s seminal work Ways of Seeing (1972) challenged traditional art criticism by examining the social context of visual perception. Subsequent scholars have extended this analysis to digital media (Mirzoeff, 2015).', 'MLA', 'Berger, John. Ways of Seeing. Penguin, 1972.\nMirzoeff, Nicholas. How to See the World. Basic Books, 2015.', 'completed', 1),
    ('Engineering Technical Paper', 'Finite element analysis has become the standard method for structural simulation [1]. Recent advances in mesh-free methods offer computational advantages for complex geometries [2].', 'IEEE', '[1] O.C. Zienkiewicz, "The Finite Element Method," McGraw-Hill, 2013.\n[2] T. Belytschko et al., "Mesh-free Methods," Int. J. Num. Methods, vol. 37, pp. 229-256, 2019.', 'pending', 2),
    ('Linguistics Research', 'Chomsky''s (1957) generative grammar revolutionized the study of syntax. Usage-based approaches (Tomasello, 2003; Bybee, 2010) offer an alternative perspective grounded in cognitive and social factors.', 'APA', 'Chomsky, N. (1957). Syntactic Structures. Mouton.\nTomasello, M. (2003). Constructing a Language. Harvard UP.\nBybee, J. (2010). Language, Usage and Cognition. Cambridge UP.', 'completed', 1),
    ('Public Health Study', 'Vaccination coverage rates have been declining in several developed nations (WHO, 2023). Vaccine hesitancy, identified by the WHO as a top ten global health threat, correlates strongly with social media misinformation exposure (Larson et al., 2022).', 'Vancouver', '1. World Health Organization. Global Vaccination Report 2023. Geneva: WHO; 2023.\n2. Larson HJ, et al. Social media and vaccine hesitancy. Vaccine. 2022;40(15):2345-52.', 'pending', 2),
    ('Economics Working Paper', 'Keynesian multiplier effects have been re-examined in the context of modern monetary theory (Kelton, 2020). Empirical evidence from the 2008 financial crisis supports larger multiplier estimates than previously assumed (Blanchard & Leigh, 2013).', 'APA', 'Kelton, S. (2020). The Deficit Myth. PublicAffairs.\nBlanchard, O., & Leigh, D. (2013). Growth Forecast Errors. AER Papers, 103(3), 117-120.', 'completed', 1);
  `);

  // Seed paraphrase detections (15 items)
  await pool.query(`
    INSERT INTO paraphrase_detections (title, original_text, comparison_text, similarity_score, status, submitted_by) VALUES
    ('Climate Change Passage', 'Global warming is causing sea levels to rise at an unprecedented rate, threatening coastal communities worldwide.', 'The rise in global temperatures has led to sea level increases at rates never before seen, putting coastal populations at risk around the world.', 82, 'completed', 1),
    ('AI Development Text', 'Artificial intelligence has made remarkable strides in natural language processing, enabling machines to understand and generate human-like text.', 'The field of AI has achieved significant progress in processing natural language, allowing computers to comprehend and produce text that resembles human writing.', 88, 'completed', 2),
    ('Historical Event Description', 'The French Revolution of 1789 fundamentally transformed European political structures and inspired democratic movements across the globe.', 'Beginning in 1789, the revolution in France brought about radical changes to political systems in Europe and motivated democracy movements worldwide.', 79, 'completed', 1),
    ('Scientific Method Explanation', 'The scientific method involves forming hypotheses, designing experiments, collecting data, and drawing conclusions based on empirical evidence.', 'Scientific inquiry requires the development of hypotheses, creation of experimental designs, gathering of data, and reaching conclusions supported by empirical findings.', 91, 'completed', 2),
    ('Economic Theory Passage', 'Supply and demand dynamics determine market prices in a free economy, with equilibrium occurring where the two curves intersect.', 'In a free market economy, the interaction of supply and demand forces establishes prices, reaching balance at the point where both curves meet.', 85, 'completed', 1),
    ('Biology Cell Description', 'Mitochondria are the powerhouses of the cell, converting nutrients into ATP through the process of cellular respiration.', 'The mitochondria serve as energy generators within cells, transforming nutrients into ATP via cellular respiration processes.', 87, 'completed', 2),
    ('Literature Analysis', 'Shakespeare''s tragedies explore the human condition through characters who face impossible moral choices that lead to their downfall.', 'The tragic works of Shakespeare examine the nature of humanity through figures confronting impossible ethical decisions that ultimately cause their destruction.', 83, 'pending', 1),
    ('Technology Impact Statement', 'The internet has revolutionized communication, making it possible to share information instantaneously across vast distances.', 'Communication has been transformed by the internet, which enables the instant sharing of information across great distances.', 90, 'completed', 2),
    ('Psychology Concept', 'Cognitive dissonance occurs when individuals hold contradictory beliefs, creating psychological discomfort that motivates belief change.', 'When people maintain conflicting beliefs simultaneously, they experience cognitive dissonance - a state of psychological unease that drives them to modify their beliefs.', 86, 'completed', 1),
    ('Environmental Policy', 'Carbon taxation policies aim to reduce greenhouse gas emissions by making fossil fuel consumption more expensive for consumers and businesses.', 'Policies implementing carbon taxes seek to decrease emissions of greenhouse gases by increasing the cost of using fossil fuels for both consumers and corporations.', 92, 'completed', 2),
    ('Philosophy Statement', 'Existentialism emphasizes individual freedom and responsibility, arguing that humans create their own meaning in an inherently meaningless universe.', 'The philosophy of existentialism stresses personal liberty and accountability, maintaining that people construct their own purpose within a universe that lacks inherent meaning.', 89, 'pending', 1),
    ('Medical Description', 'Antibiotics work by either killing bacteria directly or preventing them from reproducing, allowing the immune system to clear the infection.', 'The mechanism of antibiotics involves either direct destruction of bacteria or inhibition of their reproduction, enabling the body''s immune defenses to eliminate the infection.', 84, 'completed', 2),
    ('Education Philosophy', 'Progressive education focuses on learning by doing, encouraging students to engage with real-world problems rather than memorizing facts.', 'The progressive approach to education emphasizes experiential learning, motivating students to tackle authentic problems instead of rote memorization of information.', 87, 'completed', 1),
    ('Sociology Concept', 'Social stratification creates hierarchical layers in society based on wealth, power, and prestige, limiting social mobility for disadvantaged groups.', 'Society is organized into hierarchical strata through social stratification, which is based on factors of wealth, power, and prestige, restricting upward mobility for marginalized populations.', 81, 'pending', 2),
    ('Physics Principle', 'Einstein''s theory of relativity demonstrates that space and time are interconnected, and that the speed of light is constant in all reference frames.', 'The relativity theory proposed by Einstein shows that space and time are linked together, and that light travels at a constant speed regardless of the observer''s frame of reference.', 88, 'completed', 1);
  `);

  // Seed source matches (15 items)
  await pool.query(`
    INSERT INTO source_matches (title, content, search_scope, matches_found, status, submitted_by) VALUES
    ('Suspicious Introduction Paragraph', 'The rapid advancement of artificial intelligence has transformed nearly every aspect of modern society, from healthcare to transportation, education to entertainment.', 'web', 3, 'completed', 1),
    ('Research Methodology Section', 'A mixed-methods approach was employed, combining quantitative survey data from 500 participants with qualitative interviews conducted over a six-month period.', 'academic', 1, 'completed', 2),
    ('Wikipedia-Like Content', 'The Great Wall of China is a series of fortifications made of stone, brick, tamped earth, and other materials, built along the historical northern borders of China.', 'web', 5, 'completed', 1),
    ('Textbook Passage Check', 'Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy, storing it in the bonds of sugar molecules.', 'academic', 4, 'completed', 2),
    ('Student Essay Opening', 'In today''s interconnected world, globalization has become one of the most debated topics in international relations and economics.', 'web', 2, 'completed', 1),
    ('Code Documentation', 'This function implements the binary search algorithm, which works by repeatedly dividing the search interval in half until the target value is found or the interval is empty.', 'web', 3, 'completed', 2),
    ('Legal Brief Excerpt', 'The First Amendment to the United States Constitution prohibits the government from making laws that abridge the freedom of speech, the press, or the right to peaceful assembly.', 'academic', 6, 'completed', 1),
    ('Marketing Copy Review', 'Our revolutionary platform leverages cutting-edge artificial intelligence to deliver personalized experiences at scale, transforming how businesses engage with their customers.', 'web', 2, 'completed', 2),
    ('Dissertation Abstract', 'This dissertation examines the impact of social media usage on adolescent mental health outcomes, with particular focus on the relationship between screen time and depressive symptoms.', 'academic', 1, 'completed', 1),
    ('News Article Fragment', 'Scientists have discovered a new species of deep-sea fish in the Mariana Trench, the deepest known location on Earth''s surface, during a recent expedition.', 'web', 4, 'completed', 2),
    ('Product Description', 'The ergonomic design features a contoured grip that reduces hand fatigue during extended use, while the precision-engineered components ensure reliable performance in any condition.', 'web', 1, 'pending', 1),
    ('Academic Book Chapter', 'The Industrial Revolution fundamentally altered the relationship between labor and capital, creating new social classes and transforming the economic landscape of Western Europe.', 'academic', 3, 'completed', 2),
    ('Scientific Abstract', 'We present a novel deep learning architecture that achieves state-of-the-art performance on multiple natural language understanding benchmarks while requiring 40% fewer parameters.', 'academic', 2, 'completed', 1),
    ('Blog Content Check', 'Ten proven strategies to boost your productivity and achieve your goals: from time blocking to the Pomodoro technique, these methods are backed by scientific research.', 'web', 5, 'completed', 2),
    ('Government Report Excerpt', 'The fiscal year 2024 budget proposal allocates $1.7 trillion to discretionary spending, with significant increases in education, healthcare, and infrastructure investments.', 'web', 3, 'pending', 1);
  `);

  // Seed batch jobs (15 items)
  await pool.query(`
    INSERT INTO batch_jobs (title, job_type, documents, priority, status, total_items, processed_items, submitted_by) VALUES
    ('Fall 2024 Final Essays - Biology', 'plagiarism_scan', '["essay1.pdf","essay2.pdf","essay3.pdf","essay4.pdf","essay5.pdf"]', 'high', 'completed', 5, 5, 1),
    ('CS101 Homework Submissions', 'ai_detection', '["hw1.txt","hw2.txt","hw3.txt","hw4.txt"]', 'normal', 'completed', 4, 4, 2),
    ('Graduate Thesis Collection', 'full_analysis', '["thesis1.pdf","thesis2.pdf","thesis3.pdf"]', 'high', 'completed', 3, 3, 1),
    ('English Lit Midterm Papers', 'plagiarism_scan', '["paper1.docx","paper2.docx","paper3.docx","paper4.docx","paper5.docx","paper6.docx"]', 'normal', 'completed', 6, 6, 2),
    ('Research Grant Applications', 'ai_detection', '["grant1.pdf","grant2.pdf","grant3.pdf","grant4.pdf"]', 'high', 'processing', 4, 2, 1),
    ('Philosophy Department Review', 'writing_analysis', '["phil1.txt","phil2.txt","phil3.txt","phil4.txt","phil5.txt"]', 'normal', 'completed', 5, 5, 2),
    ('MBA Case Studies', 'plagiarism_scan', '["case1.pdf","case2.pdf","case3.pdf"]', 'low', 'completed', 3, 3, 1),
    ('Medical School Applications', 'ai_detection', '["app1.pdf","app2.pdf","app3.pdf","app4.pdf","app5.pdf","app6.pdf","app7.pdf"]', 'high', 'completed', 7, 7, 2),
    ('Journalism Portfolio Reviews', 'source_matching', '["article1.txt","article2.txt","article3.txt","article4.txt"]', 'normal', 'pending', 4, 0, 1),
    ('Law Review Submissions', 'full_analysis', '["review1.pdf","review2.pdf","review3.pdf","review4.pdf","review5.pdf"]', 'high', 'completed', 5, 5, 2),
    ('Summer Course Essays', 'plagiarism_scan', '["summer1.docx","summer2.docx","summer3.docx"]', 'low', 'completed', 3, 3, 1),
    ('PhD Qualifying Exams', 'ai_detection', '["exam1.pdf","exam2.pdf","exam3.pdf","exam4.pdf"]', 'high', 'processing', 4, 1, 2),
    ('Student Newspaper Articles', 'source_matching', '["news1.txt","news2.txt","news3.txt","news4.txt","news5.txt"]', 'normal', 'completed', 5, 5, 1),
    ('International Student Papers', 'writing_analysis', '["intl1.pdf","intl2.pdf","intl3.pdf","intl4.pdf","intl5.pdf","intl6.pdf"]', 'normal', 'pending', 6, 0, 2),
    ('Faculty Research Papers', 'full_analysis', '["faculty1.pdf","faculty2.pdf","faculty3.pdf","faculty4.pdf"]', 'high', 'completed', 4, 4, 1);
  `);

  // Seed students (15 items)
  await pool.query(`
    INSERT INTO students (name, email, student_id, department, institution) VALUES
    ('Alice Thompson', 'alice.t@student.edu', 'STU-2024-001', 'Computer Science', 'State University'),
    ('Bob Martinez', 'bob.m@student.edu', 'STU-2024-002', 'Biology', 'State University'),
    ('Carol Davis', 'carol.d@student.edu', 'STU-2024-003', 'English Literature', 'State University'),
    ('Daniel Kim', 'daniel.k@student.edu', 'STU-2024-004', 'Physics', 'State University'),
    ('Eva Johansson', 'eva.j@student.edu', 'STU-2024-005', 'Psychology', 'State University'),
    ('Frank O''Brien', 'frank.o@student.edu', 'STU-2024-006', 'Business', 'State University'),
    ('Grace Liu', 'grace.l@student.edu', 'STU-2024-007', 'Mathematics', 'State University'),
    ('Henry Patel', 'henry.p@student.edu', 'STU-2024-008', 'Chemistry', 'State University'),
    ('Isabella Santos', 'isabella.s@student.edu', 'STU-2024-009', 'History', 'State University'),
    ('Jack Wilson', 'jack.w@student.edu', 'STU-2024-010', 'Engineering', 'State University'),
    ('Karen Nguyen', 'karen.n@student.edu', 'STU-2024-011', 'Sociology', 'State University'),
    ('Leo Rossi', 'leo.r@student.edu', 'STU-2024-012', 'Philosophy', 'State University'),
    ('Mia Anderson', 'mia.a@student.edu', 'STU-2024-013', 'Art History', 'State University'),
    ('Nathan Brown', 'nathan.b@student.edu', 'STU-2024-014', 'Political Science', 'State University'),
    ('Olivia Chang', 'olivia.c@student.edu', 'STU-2024-015', 'Economics', 'State University');
  `);

  // Seed integrity scores (15 items)
  await pool.query(`
    INSERT INTO integrity_scores (title, entity_name, entity_type, content, score, status, evaluated_by) VALUES
    ('Alice Thompson - Fall Essay', 'Alice Thompson', 'student', 'Evaluated based on 5 submitted essays in Fall semester', 92, 'completed', 1),
    ('Biology 101 Course Average', 'Biology 101', 'course', 'Aggregate integrity score across all submissions', 87, 'completed', 2),
    ('CS Department Score', 'Computer Science Dept', 'department', 'Department-wide integrity assessment for 2024', 91, 'completed', 1),
    ('Bob Martinez - Research Paper', 'Bob Martinez', 'student', 'Integrity evaluation of senior research paper', 78, 'completed', 2),
    ('English Literature Course', 'ENG 201', 'course', 'Course integrity metrics for current semester', 85, 'completed', 1),
    ('Graduate School Average', 'Graduate Programs', 'institution', 'Overall graduate-level integrity score', 94, 'completed', 2),
    ('Daniel Kim - Lab Reports', 'Daniel Kim', 'student', 'Series of 8 lab reports evaluated for originality', 96, 'completed', 1),
    ('Business School Assessment', 'MBA Program', 'department', 'Annual integrity assessment for business school', 83, 'completed', 2),
    ('Carol Davis - Thesis Draft', 'Carol Davis', 'student', 'Preliminary integrity check on thesis chapters 1-3', 89, 'completed', 1),
    ('Physics Department Review', 'Physics Dept', 'department', 'Bi-annual integrity review including all faculty papers', 95, 'completed', 2),
    ('Eva Johansson - Case Studies', 'Eva Johansson', 'student', 'Collection of 4 psychology case studies', 81, 'pending', 1),
    ('University-Wide Score 2024', 'State University', 'institution', 'Comprehensive institutional integrity metric', 88, 'completed', 2),
    ('Frank O''Brien - Business Plan', 'Frank O''Brien', 'student', 'Capstone business plan project evaluation', 73, 'completed', 1),
    ('History Department', 'History Dept', 'department', 'Department integrity review for spring semester', 90, 'completed', 2),
    ('Summer Program Integrity', 'Summer Programs', 'institution', 'Integrity assessment across all summer courses', 86, 'pending', 1);
  `);

  // Seed submissions (15 items)
  await pool.query(`
    INSERT INTO submissions (title, student_name, course, assignment, content, submission_type, status, submitted_by) VALUES
    ('The Role of AI in Modern Education', 'Alice Thompson', 'CS 301', 'Final Essay', 'Artificial intelligence is increasingly being integrated into educational platforms, offering personalized learning experiences that adapt to individual student needs and learning styles.', 'essay', 'reviewed', 1),
    ('Photosynthesis Lab Report', 'Bob Martinez', 'BIO 101', 'Lab Report 3', 'This experiment measured the rate of photosynthesis in Elodea plants under varying light intensities using a dissolved oxygen probe.', 'lab_report', 'pending', 2),
    ('Analysis of The Great Gatsby', 'Carol Davis', 'ENG 201', 'Midterm Paper', 'F. Scott Fitzgerald''s The Great Gatsby serves as both a love story and a critique of the American Dream, revealing the moral decay beneath the glittering surface of the Jazz Age.', 'essay', 'reviewed', 1),
    ('Quantum Mechanics Problem Set', 'Daniel Kim', 'PHY 401', 'Problem Set 7', 'Solutions to problems involving the Schrödinger equation, wave functions, and quantum tunneling effects in one-dimensional potential barriers.', 'homework', 'pending', 2),
    ('Cognitive Development Case Study', 'Eva Johansson', 'PSY 301', 'Case Study 2', 'This case study examines the cognitive development of a 7-year-old child through the lens of Piaget''s stages of cognitive development theory.', 'case_study', 'reviewed', 1),
    ('Market Analysis: Electric Vehicles', 'Frank O''Brien', 'BUS 450', 'Final Project', 'The electric vehicle market is projected to reach $823 billion by 2030, driven by regulatory incentives, declining battery costs, and growing environmental awareness.', 'project', 'pending', 2),
    ('Proof of the Fundamental Theorem', 'Grace Liu', 'MATH 301', 'Assignment 5', 'We present a rigorous proof of the Fundamental Theorem of Calculus using the epsilon-delta definition of limits and the properties of Riemann integrals.', 'homework', 'reviewed', 1),
    ('Organic Chemistry Synthesis', 'Henry Patel', 'CHEM 301', 'Lab Report 5', 'The synthesis of aspirin from salicylic acid and acetic anhydride was performed using a standard Fischer esterification procedure with sulfuric acid catalyst.', 'lab_report', 'pending', 2),
    ('The Causes of World War I', 'Isabella Santos', 'HIST 201', 'Research Paper', 'The outbreak of World War I resulted from a complex web of alliances, imperial ambitions, militarism, and nationalist tensions that had been building across Europe for decades.', 'essay', 'reviewed', 1),
    ('Bridge Design Project', 'Jack Wilson', 'ENG 350', 'Design Project', 'Our proposed bridge design utilizes a cable-stayed configuration with a main span of 450 meters, optimized for both structural efficiency and aesthetic appeal.', 'project', 'reviewed', 2),
    ('Social Inequality Research', 'Karen Nguyen', 'SOC 301', 'Term Paper', 'Income inequality in the United States has reached levels not seen since the Gilded Age, with the top 1% of earners now controlling approximately 32% of total national wealth.', 'essay', 'pending', 1),
    ('Ethics of Autonomous Weapons', 'Leo Rossi', 'PHIL 401', 'Seminar Paper', 'The development of lethal autonomous weapons systems raises profound ethical questions about the delegation of life-and-death decisions to machines without meaningful human control.', 'essay', 'reviewed', 2),
    ('Renaissance Art Comparison', 'Mia Anderson', 'ART 201', 'Visual Analysis', 'Comparing Botticelli''s Birth of Venus with Michelangelo''s Creation of Adam reveals contrasting approaches to representing the divine within the Italian Renaissance tradition.', 'essay', 'pending', 1),
    ('Electoral Systems Analysis', 'Nathan Brown', 'POL 301', 'Policy Paper', 'Proportional representation systems tend to produce more diverse legislative bodies and higher voter turnout compared to first-past-the-post systems, though they may result in coalition instability.', 'essay', 'reviewed', 2),
    ('Game Theory Applications', 'Olivia Chang', 'ECON 401', 'Research Paper', 'This paper applies Nash equilibrium analysis to real-world market competition scenarios, demonstrating how game theory can predict pricing strategies in oligopolistic markets.', 'essay', 'pending', 1);
  `);

  // Seed API keys (15 items)
  await pool.query(`
    INSERT INTO api_keys (name, api_key, permissions, rate_limit, status, usage_count, created_by) VALUES
    ('Production API Key', 'apd_prod_a1b2c3d4e5f6g7h8i9j0', 'read_write', 5000, 'active', 3245, 1),
    ('Development Key', 'apd_dev_k1l2m3n4o5p6q7r8s9t0', 'read_write', 10000, 'active', 15678, 2),
    ('Testing Environment', 'apd_test_u1v2w3x4y5z6a7b8c9d0', 'read', 2000, 'active', 892, 1),
    ('Mobile App Integration', 'apd_mob_e1f2g3h4i5j6k7l8m9n0', 'read', 3000, 'active', 2156, 2),
    ('Partner: Oxford University', 'apd_oxf_o1p2q3r4s5t6u7v8w9x0', 'read_write', 8000, 'active', 5432, 1),
    ('Partner: Cambridge Press', 'apd_cam_y1z2a3b4c5d6e7f8g9h0', 'read', 5000, 'active', 1876, 2),
    ('Internal Analytics', 'apd_int_i1j2k3l4m5n6o7p8q9r0', 'admin', 20000, 'active', 45231, 1),
    ('Staging Server', 'apd_stg_s1t2u3v4w5x6y7z8a9b0', 'read_write', 10000, 'active', 7654, 2),
    ('Legacy System Bridge', 'apd_leg_c1d2e3f4g5h6i7j8k9l0', 'read', 1000, 'inactive', 234, 1),
    ('Student Portal', 'apd_stu_m1n2o3p4q5r6s7t8u9v0', 'read', 2000, 'active', 4567, 2),
    ('Faculty Dashboard', 'apd_fac_w1x2y3z4a5b6c7d8e9f0', 'read_write', 5000, 'active', 2345, 1),
    ('Third Party: Turnitin', 'apd_tur_g1h2i3j4k5l6m7n8o9p0', 'read_write', 15000, 'active', 12456, 2),
    ('Webhook Service', 'apd_whk_q1r2s3t4u5v6w7x8y9z0', 'write', 3000, 'active', 1234, 1),
    ('Batch Processing Service', 'apd_bat_a2b3c4d5e6f7g8h9i0j1', 'admin', 25000, 'active', 8765, 2),
    ('Deprecated V1 Key', 'apd_v1_k2l3m4n5o6p7q8r9s0t1', 'read', 500, 'inactive', 56, 1);
  `);

  console.log('✅ Database seeded successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});
