Feature: Login through the automation portal
  As an automation engineer
  I want reusable BDD coverage
  So that UI workflows can share the same business layer

  Scenario: Standard user signs in successfully
    Given the local mock services are running
    When the standard user logs in through the login page
    Then the welcome message should be "Welcome, standard_user"
