import csv

# Create a row of data containing info about confirmed cases, deaths, and population.
def processRow(confirmedRow, populationRow, deathsRow, isTopRow):
    countyFIPS = confirmedRow[0]
    countyName = confirmedRow[1]
    state = confirmedRow[2]
    stateFIPS = confirmedRow[3]
    population = populationRow[3]
    singleStats = [countyFIPS, countyName, state, stateFIPS, population]

    confirmedCases = confirmedRow[4:]
    deaths = deathsRow[4:]
    if isTopRow:
        confirmedCases = list(map(lambda x: "confirmed_" + x, confirmedCases))
        deaths = list(map(lambda x: "deaths_" + x, deaths))

    return singleStats + confirmedCases + deaths

with open('covid_confirmed_usafacts.csv') as confirmedFile:
    with open('covid_county_population_usafacts.csv') as populationFile:
        with open('covid_deaths_usafacts.csv') as deathsFile:
            with open('covid_all.csv', 'w', newline='') as allDataFile:

                confirmedReader = csv.reader(confirmedFile)
                populationReader = csv.reader(populationFile)
                deathsReader = csv.reader(deathsFile)
                allDataWriter = csv.writer(allDataFile)

                try:
                    confirmedRow = confirmedReader.__next__()
                    populationRow = populationReader.__next__()
                    deathsRow = deathsReader.__next__()
                    allDataWriter.writerow(processRow(confirmedRow, populationRow, deathsRow, True))
                    
                    while (True):
                        confirmedRow = confirmedReader.__next__()
                        populationRow = populationReader.__next__()
                        deathsRow = deathsReader.__next__()
                        allDataWriter.writerow(processRow(confirmedRow, populationRow, deathsRow, False))
                
                except StopIteration:
                    print("CSV processing complete.")