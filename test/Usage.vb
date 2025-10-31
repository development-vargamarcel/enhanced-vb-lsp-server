Module TestModule
    Sub Main()
        Dim calc As New ComplexCalculator()  ' Should show class documentation
        
        ' Test method chaining
        calc.AddValue(10.5).AddValue(20.3)   ' Should show method documentation
        
        ' Test property access
        calc.CustomMultiplier = 2.0          ' Should show property documentation
        
        ' Test method with complex return type
        Dim result As ComplexCalculator.CalculationResult
        result = calc.GetLastResult()         ' Should show structure documentation
        
        ' Test calculation methods
        Dim sum = calc.CalculateSum()         ' Should show method documentation
        Dim avg = calc.CalculateAverage()     ' Should show method documentation
        
        ' Test events
        AddHandler calc.CalculationCompleted, AddressOf HandleCalculation
    End Sub
    
    Sub HandleCalculation(sender As Object, result As Double)
        ' Event handler
    End Sub
End Module