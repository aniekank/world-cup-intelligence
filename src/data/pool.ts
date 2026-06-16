/**
 * Name & club pools for procedural squad generation. Each team maps to a
 * regional name bank so generated players read as nationally plausible.
 */

export type RegionKey =
  | 'latin'
  | 'brazil'
  | 'anglo'
  | 'germanic'
  | 'french'
  | 'dutch'
  | 'nordic'
  | 'slavic'
  | 'arab'
  | 'westAfrica'
  | 'eastAsia'
  | 'korea'
  | 'japan';

export const TEAM_REGION: Record<string, RegionKey> = {
  MEX: 'latin', CRO: 'slavic', ECU: 'latin', QAT: 'arab',
  CAN: 'anglo', BEL: 'dutch', KOR: 'korea', GHA: 'westAfrica',
  USA: 'anglo', NED: 'dutch', JPN: 'japan', EGY: 'arab',
  FRA: 'french', SEN: 'westAfrica', AUS: 'anglo', PAN: 'latin',
  ESP: 'latin', URU: 'latin', CIV: 'westAfrica', NZL: 'anglo',
  ENG: 'anglo', COL: 'latin', IRN: 'arab', NOR: 'nordic',
  BRA: 'brazil', SUI: 'germanic', NGA: 'westAfrica', KSA: 'arab',
  POR: 'latin', MAR: 'arab', PAR: 'latin', UZB: 'slavic',
  ARG: 'latin', AUT: 'germanic', TUN: 'arab', JOR: 'arab',
  GER: 'germanic', SCO: 'anglo', MLI: 'westAfrica', CRC: 'latin',
  ITA: 'latin', PER: 'latin', CMR: 'westAfrica', CUW: 'dutch',
  DEN: 'nordic', ALG: 'arab', CHI: 'latin', JAM: 'anglo',
};

interface Bank {
  first: string[];
  last: string[];
}

export const NAME_BANKS: Record<RegionKey, Bank> = {
  latin: {
    first: ['Diego', 'Carlos', 'Luis', 'Javier', 'Sergio', 'Pablo', 'Andrés', 'Rodrigo', 'Mateo', 'Santiago', 'Nicolás', 'Gonzalo', 'Federico', 'Emiliano', 'Lautaro', 'Facundo', 'Cristian', 'Marcos', 'Iván', 'Hernán'],
    last: ['García', 'Martínez', 'Rodríguez', 'López', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Díaz', 'Vargas', 'Castro', 'Romero', 'Herrera', 'Morales', 'Ortega', 'Silva', 'Núñez', 'Cabrera'],
  },
  brazil: {
    first: ['Gabriel', 'Lucas', 'Rafael', 'Bruno', 'Vinícius', 'Matheus', 'Rodrygo', 'Éder', 'Caio', 'Pedro', 'Antony', 'Richarlison', 'Endrick', 'Marquinhos', 'Casemiro', 'Danilo', 'Raphael', 'Wesley', 'João', 'Igor'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Pereira', 'Lima', 'Costa', 'Ribeiro', 'Almeida', 'Fernandes', 'Rodrigues', 'Gomes', 'Martins', 'Araújo', 'Barbosa', 'Carvalho', 'Nascimento', 'Moreira', 'Cardoso', 'Pinto'],
  },
  anglo: {
    first: ['Jack', 'Harry', 'James', 'Tyler', 'Ryan', 'Owen', 'Liam', 'Ethan', 'Cole', 'Mason', 'Connor', 'Jordan', 'Cameron', 'Brandon', 'Aaron', 'Lewis', 'Dylan', 'Marcus', 'Reece', 'Kyle'],
    last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Taylor', 'Wilson', 'Walker', 'Wright', 'Robinson', 'Thompson', 'Anderson', 'Mitchell', 'Carter', 'Phillips', 'Campbell', 'Murphy', 'Bennett', 'Hughes', 'Reid', 'Adams'],
  },
  germanic: {
    first: ['Leon', 'Florian', 'Jonas', 'Niklas', 'Maximilian', 'Felix', 'Lukas', 'David', 'Julian', 'Marco', 'Pascal', 'Tim', 'Kai', 'Robin', 'Sven', 'Moritz', 'Jan', 'Nico', 'Fabian', 'Tobias'],
    last: ['Müller', 'Schmidt', 'Wagner', 'Becker', 'Hofmann', 'Fischer', 'Weber', 'Koch', 'Richter', 'Klein', 'Wolf', 'Neumann', 'Schwarz', 'Krüger', 'Werner', 'Lehmann', 'Brandt', 'Gruber', 'Berger', 'Huber'],
  },
  french: {
    first: ['Kylian', 'Antoine', 'Hugo', 'Théo', 'Lucas', 'Aurélien', 'Ousmane', 'Eduardo', 'Marcus', 'Bradley', 'Jules', 'Ibrahima', 'Warren', 'Mattéo', 'Randal', 'Adrien', 'Dayot', 'Manu', 'Christopher', 'Youssouf'],
    last: ['Dubois', 'Martin', 'Bernard', 'Laurent', 'Lefebvre', 'Mbappé', 'Rabiot', 'Coman', 'Camavinga', 'Konaté', 'Saliba', 'Thuram', 'Dembélé', 'Kolo Muani', 'Tchouaméni', 'Maignan', 'Pavard', 'Fofana', 'Barcola', 'Zaïre'],
  },
  dutch: {
    first: ['Cody', 'Frenkie', 'Memphis', 'Virgil', 'Denzel', 'Xavi', 'Tijjani', 'Jeremie', 'Nathan', 'Wout', 'Teun', 'Jurriën', 'Ryan', 'Lutsharel', 'Quinten', 'Brian', 'Joey', 'Sven', 'Bart', 'Mats'],
    last: ['de Jong', 'van Dijk', 'Dumfries', 'Depay', 'Simons', 'Gakpo', 'Reijnders', 'Frimpong', 'Aké', 'Weghorst', 'Koopmeiners', 'Timber', 'Geertruida', 'Verbruggen', 'Malen', 'van de Ven', 'Veerman', 'Bergwijn', 'Hartman', 'Wieffer'],
  },
  nordic: {
    first: ['Erling', 'Martin', 'Alexander', 'Viktor', 'Emil', 'Oscar', 'Mikkel', 'Pierre', 'Rasmus', 'Joakim', 'Kristian', 'Anders', 'Henrik', 'Sander', 'Patrick', 'Jonas', 'Magnus', 'Fredrik', 'Andreas', 'Mathias'],
    last: ['Haaland', 'Ødegaard', 'Sørloth', 'Højlund', 'Lindelöf', 'Forsberg', 'Damsgaard', 'Eriksen', 'Nusa', 'Bobb', 'Berge', 'Hjulmand', 'Wind', 'Bah', 'Aursnes', 'Ryerson', 'Strand Larsen', 'Andersen', 'Olsen', 'Larsen'],
  },
  slavic: {
    first: ['Luka', 'Marcelo', 'Mateo', 'Andrej', 'Joško', 'Josip', 'Ivan', 'Mario', 'Borna', 'Eldin', 'Akmal', 'Abbosbek', 'Jaloliddin', 'Otabek', 'Igor', 'Nikola', 'Dejan', 'Marko', 'Stefan', 'Vedran'],
    last: ['Modrić', 'Brozović', 'Kovačić', 'Kramarić', 'Gvardiol', 'Perišić', 'Sosa', 'Pašalić', 'Sučić', 'Stanišić', 'Yusupov', 'Faizullaev', 'Masharipov', 'Shomurodov', 'Petrović', 'Jović', 'Vlahović', 'Milinković', 'Tadić', 'Vlašić'],
  },
  arab: {
    first: ['Mohamed', 'Ahmed', 'Youssef', 'Achraf', 'Hakim', 'Sofyan', 'Mehdi', 'Karim', 'Ali', 'Hassan', 'Omar', 'Sami', 'Bilal', 'Riyad', 'Ismaël', 'Nayef', 'Salem', 'Saleh', 'Sardar', 'Mehdi'],
    last: ['Salah', 'Hakimi', 'Ziyech', 'Amrabat', 'Taremi', 'Benzema', 'Mahrez', 'En-Nesyri', 'Bounou', 'Hassan', 'Trezeguet', 'Aboukhlal', 'Ounahi', 'Mazraoui', 'Saiss', 'Al-Dawsari', 'Azmoun', 'Jahanbakhsh', 'Brahimi', 'Bennacer'],
  },
  westAfrica: {
    first: ['Sadio', 'Kalidou', 'Ismaïla', 'Nicolas', 'Victor', 'Ademola', 'Mohammed', 'Thomas', 'Iñaki', 'Sébastien', 'Franck', 'André', 'Edmond', 'Amad', 'Wilfried', 'Yves', 'Serhou', 'Boulaye', 'Pape', 'Habib'],
    last: ['Mané', 'Koulibaly', 'Sarr', 'Pépé', 'Osimhen', 'Lookman', 'Kudus', 'Partey', 'Williams', 'Haller', 'Kessié', 'Onana', 'Tanganga', 'Diallo', 'Zaha', 'Bissouma', 'Guirassy', 'Dia', 'Gueye', 'Diatta'],
  },
  eastAsia: {
    first: ['Wei', 'Hao', 'Jun', 'Lei', 'Yang', 'Chen', 'Feng', 'Kai', 'Long', 'Ming'],
    last: ['Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Huang', 'Zhao', 'Wu', 'Zhou'],
  },
  korea: {
    first: ['Heung-min', 'Min-jae', 'Kang-in', 'Hee-chan', 'Woo-young', 'Jin-su', 'Young-gwon', 'In-beom', 'Seung-ho', 'Gue-sung', 'Jae-sung', 'Ui-jo', 'Chan-hee', 'Tae-hwan', 'Moon-hwan', 'Sung-yueng', 'Ji-soo', 'Do-hwan', 'Sang-ho', 'Kyu-sung'],
    last: ['Son', 'Kim', 'Lee', 'Hwang', 'Jung', 'Park', 'Cho', 'Hong', 'Kwon', 'Oh', 'Bae', 'Seol', 'Yang', 'Na', 'Joo', 'Koo', 'Paik', 'Cho', 'Um', 'Jeong'],
  },
  japan: {
    first: ['Takefusa', 'Kaoru', 'Wataru', 'Ritsu', 'Daichi', 'Takehiro', 'Junya', 'Ko', 'Ayase', 'Hidemasa', 'Reo', 'Takumi', 'Daizen', 'Keito', 'Shogo', 'Yukinari', 'Hiroki', 'Kyogo', 'Ao', 'Seko'],
    last: ['Kubo', 'Mitoma', 'Endo', 'Doan', 'Kamada', 'Tomiyasu', 'Ito', 'Itakura', 'Ueda', 'Morita', 'Hatate', 'Minamino', 'Maeda', 'Nakamura', 'Taniguchi', 'Sugawara', 'Ito', 'Furuhashi', 'Tanaka', 'Asano'],
  },
};

export const CLUBS = [
  'Real Madrid', 'Manchester City', 'Bayern Munich', 'Liverpool', 'Arsenal', 'Paris SG',
  'Barcelona', 'Inter Milan', 'Atlético Madrid', 'Bayer Leverkusen', 'Chelsea', 'Tottenham',
  'Napoli', 'Juventus', 'Borussia Dortmund', 'AC Milan', 'Manchester United', 'Newcastle',
  'Aston Villa', 'Atalanta', 'RB Leipzig', 'Benfica', 'Porto', 'Ajax', 'PSV', 'Sporting CP',
  'Marseille', 'Monaco', 'Brighton', 'West Ham', 'Roma', 'Lazio', 'Sevilla', 'Real Sociedad',
  'Villarreal', 'Fiorentina', 'Crystal Palace', 'Fulham', 'Stuttgart', 'Eintracht Frankfurt',
  'Galatasaray', 'Fenerbahçe', 'Feyenoord', 'Celtic', 'Rangers', 'Al-Hilal', 'Al-Nassr', 'Flamengo',
];

export const VENUES: { stadium: string; city: string }[] = [
  { stadium: 'MetLife Stadium', city: 'New York/NJ' },
  { stadium: 'SoFi Stadium', city: 'Los Angeles' },
  { stadium: 'AT&T Stadium', city: 'Dallas' },
  { stadium: 'Mercedes-Benz Stadium', city: 'Atlanta' },
  { stadium: 'Arrowhead Stadium', city: 'Kansas City' },
  { stadium: 'NRG Stadium', city: 'Houston' },
  { stadium: 'Lincoln Financial Field', city: 'Philadelphia' },
  { stadium: 'Levi’s Stadium', city: 'San Francisco' },
  { stadium: 'Lumen Field', city: 'Seattle' },
  { stadium: 'Gillette Stadium', city: 'Boston' },
  { stadium: 'Hard Rock Stadium', city: 'Miami' },
  { stadium: 'BMO Field', city: 'Toronto' },
  { stadium: 'BC Place', city: 'Vancouver' },
  { stadium: 'Estadio Azteca', city: 'Mexico City' },
  { stadium: 'Estadio Akron', city: 'Guadalajara' },
  { stadium: 'Estadio BBVA', city: 'Monterrey' },
];
